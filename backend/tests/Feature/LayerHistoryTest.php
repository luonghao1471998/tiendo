<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LayerHistoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_layer_history_includes_live_zone_and_mark_logs(): void
    {
        [$pm, $layer] = $this->createContext();

        Sanctum::actingAs($pm);

        $zoneResp = $this->postJson('/api/v1/layers/'.$layer->id.'/zones', [
            'name' => 'Z1',
            'geometry_pct' => $this->geometry(),
        ])->assertStatus(201);

        $zoneId = $zoneResp->json('data.id');

        $this->postJson('/api/v1/zones/'.$zoneId.'/marks', [
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
        ])->assertStatus(201);

        $response = $this->getJson('/api/v1/layers/'.$layer->id.'/history');
        $response->assertOk()
            ->assertJsonPath('success', true);

        $targetTypes = collect($response->json('data'))->pluck('target_type')->all();
        $this->assertContains('zone', $targetTypes);
        $this->assertContains('mark', $targetTypes);
    }

    public function test_layer_history_includes_deleted_zone_logs(): void
    {
        [$pm, $layer] = $this->createContext();

        $zone = Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Z1',
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 30,
            'created_by' => $pm->id,
        ]);

        $zoneId = $zone->id;

        Sanctum::actingAs($pm);
        $this->deleteJson('/api/v1/zones/'.$zoneId)->assertOk();

        $this->assertDatabaseMissing('zones', ['id' => $zoneId]);

        $response = $this->getJson('/api/v1/layers/'.$layer->id.'/history');
        $response->assertOk();

        $targetIds = collect($response->json('data'))
            ->where('target_type', 'zone')
            ->pluck('target_id')
            ->all();

        $this->assertContains($zoneId, $targetIds);
    }

    public function test_layer_history_only_includes_zones_belonging_to_that_layer(): void
    {
        [$pm, $layer] = $this->createContext();
        [, $otherLayer] = $this->createContext('P2', 'PR2');

        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Z1',
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 30,
            'created_by' => $pm->id,
        ]);

        $otherZone = Zone::query()->create([
            'layer_id' => $otherLayer->id,
            'zone_code' => 'PR2_T1_KT_001',
            'name' => 'OtherZ',
            'geometry_pct' => $this->geometry(),
            'status' => 'not_started',
            'completion_pct' => 0,
            'created_by' => $pm->id,
        ]);

        Sanctum::actingAs($pm);

        $response = $this->getJson('/api/v1/layers/'.$layer->id.'/history');
        $response->assertOk();

        $targetIds = collect($response->json('data'))
            ->where('target_type', 'zone')
            ->pluck('target_id')
            ->all();

        $this->assertNotContains($otherZone->id, $targetIds);
    }

    public function test_outsider_cannot_see_layer_history(): void
    {
        [$pm, $layer] = $this->createContext();
        $outsider = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        Sanctum::actingAs($outsider);
        $this->getJson('/api/v1/layers/'.$layer->id.'/history')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    /**
     * @return array{0: User, 1: Layer}
     */
    private function createContext(string $projectName = 'P', string $projectCode = 'PRJ'): array
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $project = Project::query()->create([
            'name' => $projectName,
            'code' => $projectCode,
            'created_by' => $pm->id,
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role' => 'project_manager',
            'created_at' => now(),
        ]);

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

        return [$pm, $layer];
    }

    /**
     * @return array<string, mixed>
     */
    private function geometry(): array
    {
        return [
            'type' => 'polygon',
            'points' => [
                ['x' => 0.1, 'y' => 0.1],
                ['x' => 0.2, 'y' => 0.1],
                ['x' => 0.2, 'y' => 0.2],
            ],
        ];
    }
}
