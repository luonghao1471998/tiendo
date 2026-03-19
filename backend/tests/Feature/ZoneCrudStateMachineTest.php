<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ZoneCrudStateMachineTest extends TestCase
{
    use RefreshDatabase;

    public function test_zone_crud_flow_for_project_manager(): void
    {
        [$user, $layer] = $this->createProjectManagerContext();
        Sanctum::actingAs($user);

        $create = $this->postJson('/api/v1/layers/'.$layer->id.'/zones', [
            'name' => 'Sanh chinh',
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.1, 'y' => 0.1],
                    ['x' => 0.5, 'y' => 0.1],
                    ['x' => 0.5, 'y' => 0.5],
                    ['x' => 0.1, 'y' => 0.5],
                ],
            ],
        ]);

        $create->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'not_started')
            ->assertJsonPath('data.completion_pct', 0);

        $zoneId = (int) $create->json('data.id');

        $this->getJson('/api/v1/layers/'.$layer->id.'/zones')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->getJson('/api/v1/zones/'.$zoneId)
            ->assertOk()
            ->assertJsonPath('data.id', $zoneId);

        $this->patchJson('/api/v1/zones/'.$zoneId.'/status', [
            'status' => 'in_progress',
        ])->assertOk()
            ->assertJsonPath('data.status', 'in_progress');

        $this->putJson('/api/v1/zones/'.$zoneId, [
            'name' => 'Sanh chinh update',
            'completion_pct' => 40,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Sanh chinh update')
            ->assertJsonPath('data.completion_pct', 40);

        $this->deleteJson('/api/v1/zones/'.$zoneId)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->getJson('/api/v1/zones/'.$zoneId)
            ->assertStatus(404)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_invalid_transition_returns_standard_error_format(): void
    {
        [$user, $layer] = $this->createProjectManagerContext();
        Sanctum::actingAs($user);

        $create = $this->postJson('/api/v1/layers/'.$layer->id.'/zones', [
            'name' => 'Zone invalid transition',
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.1, 'y' => 0.1],
                    ['x' => 0.3, 'y' => 0.1],
                    ['x' => 0.3, 'y' => 0.3],
                ],
            ],
        ])->assertStatus(201);

        $zoneId = (int) $create->json('data.id');

        $this->patchJson('/api/v1/zones/'.$zoneId.'/status', [
            'status' => 'completed',
        ])->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error.code', 'INVALID_STATE_TRANSITION')
            ->assertJsonStructure([
                'success',
                'error' => ['code', 'message', 'details'],
            ]);
    }

    public function test_field_team_cannot_update_zone_not_assigned_to_them(): void
    {
        [$pm, $layer] = $this->createProjectManagerContext();

        $field = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        ProjectMember::query()->create([
            'project_id' => $layer->masterLayer->project_id,
            'user_id' => $field->id,
            'role' => 'field_team',
            'created_at' => now(),
        ]);

        Sanctum::actingAs($pm);
        $zoneId = (int) $this->postJson('/api/v1/layers/'.$layer->id.'/zones', [
            'name' => 'Assigned to someone else',
            'assigned_user_id' => $pm->id,
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.2, 'y' => 0.2],
                    ['x' => 0.4, 'y' => 0.2],
                    ['x' => 0.4, 'y' => 0.4],
                ],
            ],
        ])->json('data.id');

        Sanctum::actingAs($field);
        $this->patchJson('/api/v1/zones/'.$zoneId.'/status', [
            'status' => 'in_progress',
        ])->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    /**
     * @return array{0: User, 1: Layer}
     */
    private function createProjectManagerContext(): array
    {
        $user = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $project = Project::query()->create([
            'name' => 'Test Project',
            'code' => 'TPJ',
            'description' => null,
            'address' => null,
            'created_by' => $user->id,
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'role' => 'project_manager',
            'created_at' => now(),
        ]);

        $masterLayer = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'Tang 1',
            'code' => 'T1',
            'sort_order' => 0,
        ]);

        $layer = Layer::query()->create([
            'master_layer_id' => $masterLayer->id,
            'name' => 'Kien truc',
            'code' => 'KT',
            'type' => 'architecture',
            'status' => 'ready',
            'sort_order' => 0,
            'original_filename' => 'a.pdf',
            'file_path' => 'layers/1/original.pdf',
            'tile_path' => 'layers/1/tiles',
            'file_size' => 1024,
            'width_px' => 1000,
            'height_px' => 1000,
            'retry_count' => 0,
            'error_message' => null,
            'processed_at' => now(),
            'next_zone_seq' => 0,
            'uploaded_by' => $user->id,
        ]);

        return [$user, $layer];
    }
}
