<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MarkCrudStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_field_team_can_create_update_and_delete_their_own_mark(): void
    {
        [$field, $zone] = $this->createFieldTeamAssignedContext();
        Sanctum::actingAs($field);

        $create = $this->postJson('/api/v1/zones/'.$zone->id.'/marks', [
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.2, 'y' => 0.2],
                    ['x' => 0.3, 'y' => 0.2],
                    ['x' => 0.3, 'y' => 0.3],
                ],
            ],
            'status' => 'in_progress',
            'note' => 'Bat dau',
        ]);

        $create->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.painted_by', $field->id);

        $markId = (int) $create->json('data.id');

        $this->getJson('/api/v1/zones/'.$zone->id.'/marks')
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->patchJson('/api/v1/marks/'.$markId.'/status', [
            'status' => 'completed',
            'note' => 'Xong',
        ])->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.note', 'Xong');

        $this->deleteJson('/api/v1/marks/'.$markId)
            ->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_field_team_cannot_create_mark_on_unassigned_zone(): void
    {
        [$field, $zone] = $this->createFieldTeamAssignedContext();

        $otherUser = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        $zone->update([
            'assigned_user_id' => $otherUser->id,
        ]);

        Sanctum::actingAs($field);

        $this->postJson('/api/v1/zones/'.$zone->id.'/marks', [
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.2, 'y' => 0.2],
                    ['x' => 0.3, 'y' => 0.2],
                    ['x' => 0.3, 'y' => 0.3],
                ],
            ],
            'status' => 'in_progress',
        ])->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_field_team_cannot_change_status_of_other_users_mark(): void
    {
        [$field, $zone] = $this->createFieldTeamAssignedContext();
        $otherField = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        ProjectMember::query()->create([
            'project_id' => $zone->layer->masterLayer->project_id,
            'user_id' => $otherField->id,
            'role' => 'field_team',
            'created_at' => now(),
        ]);

        Sanctum::actingAs($zone->creator);
        $markId = (int) $this->postJson('/api/v1/zones/'.$zone->id.'/marks', [
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.2, 'y' => 0.2],
                    ['x' => 0.3, 'y' => 0.2],
                    ['x' => 0.3, 'y' => 0.3],
                ],
            ],
            'status' => 'in_progress',
        ])->json('data.id');

        Sanctum::actingAs($field);
        $this->patchJson('/api/v1/marks/'.$markId.'/status', [
            'status' => 'completed',
        ])->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    /**
     * @return array{0: User, 1: Zone}
     */
    private function createFieldTeamAssignedContext(): array
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $field = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        $project = Project::query()->create([
            'name' => 'P',
            'code' => 'PRJ',
            'created_by' => $pm->id,
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role' => 'project_manager',
            'created_at' => now(),
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $field->id,
            'role' => 'field_team',
            'created_at' => now(),
        ]);

        $masterLayer = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'ML',
            'code' => 'T1',
            'sort_order' => 0,
        ]);

        $layer = Layer::query()->create([
            'master_layer_id' => $masterLayer->id,
            'name' => 'L',
            'code' => 'KT',
            'type' => 'architecture',
            'status' => 'ready',
            'sort_order' => 0,
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

        $zone = Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Z1',
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.1, 'y' => 0.1],
                    ['x' => 0.6, 'y' => 0.1],
                    ['x' => 0.6, 'y' => 0.6],
                ],
            ],
            'status' => 'in_progress',
            'completion_pct' => 50,
            'assigned_user_id' => $field->id,
            'created_by' => $pm->id,
        ]);

        return [$field, $zone];
    }
}
