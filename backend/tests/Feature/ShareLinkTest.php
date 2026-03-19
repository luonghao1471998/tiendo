<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\ShareLink;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShareLinkTest extends TestCase
{
    use RefreshDatabase;

    public function test_pm_can_create_share_link(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $response = $this->postJson('/api/v1/projects/'.$project->id.'/share-links', [
            'expires_in_days' => 7,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.project_id', $project->id)
            ->assertJsonPath('data.is_active', true);

        $this->assertNotNull($response->json('data.token'));
        $this->assertStringContainsString('/share/', $response->json('data.url'));
    }

    public function test_invalid_expires_days_rejected(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $this->postJson('/api/v1/projects/'.$project->id.'/share-links', [
            'expires_in_days' => 15,
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_pm_can_list_share_links(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $this->postJson('/api/v1/projects/'.$project->id.'/share-links', ['expires_in_days' => 1])
            ->assertStatus(201);
        $this->postJson('/api/v1/projects/'.$project->id.'/share-links', ['expires_in_days' => 30])
            ->assertStatus(201);

        $this->getJson('/api/v1/projects/'.$project->id.'/share-links')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_pm_can_revoke_share_link(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $linkId = $this->postJson('/api/v1/projects/'.$project->id.'/share-links', [
            'expires_in_days' => 7,
        ])->json('data.id');

        $this->deleteJson('/api/v1/share-links/'.$linkId)->assertOk();

        $this->assertDatabaseHas('share_links', ['id' => $linkId, 'is_active' => false]);
    }

    public function test_public_resolve_returns_project_data(): void
    {
        [$pm, $project, $zone] = $this->createProjectWithZone();

        Sanctum::actingAs($pm);
        $token = $this->postJson('/api/v1/projects/'.$project->id.'/share-links', [
            'expires_in_days' => 7,
        ])->json('data.token');

        // Truy cập không cần auth
        $response = $this->getJson('/api/v1/share/'.$token);

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.project.id', $project->id)
            ->assertJsonPath('data.share_link.role', 'viewer');

        $layerIds = collect($response->json('data.layers'))->pluck('id')->all();
        $this->assertNotEmpty($layerIds);

        // Zones có trong response
        $zones = collect($response->json('data.layers'))->flatMap(fn ($l) => $l['zones']);
        $this->assertTrue($zones->where('id', $zone->id)->isNotEmpty());
    }

    public function test_expired_token_returns_410(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        // Tạo link đã hết hạn trực tiếp
        $shareLink = ShareLink::query()->create([
            'project_id' => $project->id,
            'token' => 'expiredtoken123',
            'created_by' => $pm->id,
            'expires_at' => now()->subDay(),
            'is_active' => true,
            'created_at' => now(),
        ]);

        $this->getJson('/api/v1/share/'.$shareLink->token)
            ->assertStatus(410)
            ->assertJsonPath('error.code', 'SHARE_LINK_INVALID');
    }

    public function test_revoked_token_returns_410(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $resp = $this->postJson('/api/v1/projects/'.$project->id.'/share-links', [
            'expires_in_days' => 7,
        ]);
        $token = $resp->json('data.token');
        $linkId = $resp->json('data.id');

        $this->deleteJson('/api/v1/share-links/'.$linkId)->assertOk();

        $this->getJson('/api/v1/share/'.$token)
            ->assertStatus(410);
    }

    public function test_outsider_cannot_create_share_link(): void
    {
        [, $project] = $this->createProjectWithPm();
        $outsider = User::factory()->create(['role' => 'viewer', 'is_active' => true]);

        Sanctum::actingAs($outsider);
        $this->postJson('/api/v1/projects/'.$project->id.'/share-links', [
            'expires_in_days' => 7,
        ])->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------

    /**
     * @return array{0: User, 1: Project}
     */
    private function createProjectWithPm(): array
    {
        $pm = User::factory()->create(['role' => 'project_manager', 'is_active' => true]);

        $project = Project::query()->create([
            'name' => 'Proj',
            'code' => 'SL'.rand(1000, 9999),
            'created_by' => $pm->id,
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role' => 'project_manager',
            'created_at' => now(),
        ]);

        return [$pm, $project];
    }

    /**
     * @return array{0: User, 1: Project, 2: Zone}
     */
    private function createProjectWithZone(): array
    {
        [$pm, $project] = $this->createProjectWithPm();

        $masterLayer = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'ML',
            'code' => 'T1',
            'sort_order' => 1,
        ]);

        $layer = Layer::query()->create([
            'master_layer_id' => $masterLayer->id,
            'name' => 'L',
            'code' => 'KT',
            'type' => 'architecture',
            'status' => 'ready',
            'sort_order' => 1,
            'original_filename' => 'a.pdf',
            'file_path' => 'layers/1/original.pdf',
            'tile_path' => 'layers/1/tiles',
            'file_size' => 1,
            'width_px' => 1000,
            'height_px' => 1000,
            'retry_count' => 0,
            'next_zone_seq' => 1,
            'uploaded_by' => $pm->id,
        ]);

        Sanctum::actingAs($pm);
        $zoneId = $this->postJson('/api/v1/layers/'.$layer->id.'/zones', [
            'name' => 'Z1',
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.1, 'y' => 0.1],
                    ['x' => 0.2, 'y' => 0.1],
                    ['x' => 0.2, 'y' => 0.2],
                ],
            ],
        ])->assertStatus(201)->json('data.id');

        return [$pm, $project, Zone::query()->findOrFail($zoneId)];
    }
}
