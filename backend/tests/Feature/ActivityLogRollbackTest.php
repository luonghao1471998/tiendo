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

class ActivityLogRollbackTest extends TestCase
{
    use RefreshDatabase;

    public function test_zone_history_returns_zone_and_mark_activity_logs(): void
    {
        [$pm, $zone] = $this->createContext();
        Sanctum::actingAs($pm);

        $this->postJson('/api/v1/zones/'.$zone->id.'/marks', [
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
        ])->assertStatus(201);

        $response = $this->getJson('/api/v1/zones/'.$zone->id.'/history');
        $response->assertOk()
            ->assertJsonPath('success', true);

        $targetTypes = collect($response->json('data'))->pluck('target_type')->all();
        $this->assertContains('zone', $targetTypes);
        $this->assertContains('mark', $targetTypes);
    }

    public function test_project_manager_can_rollback_zone_update(): void
    {
        [$pm, $zone] = $this->createContext();
        Sanctum::actingAs($pm);

        $this->putJson('/api/v1/zones/'.$zone->id, [
            'name' => 'Z1 updated',
            'name_full' => null,
            'geometry_pct' => $this->geometry(),
            'assignee' => null,
            'assigned_user_id' => null,
            'deadline' => null,
            'tasks' => null,
            'notes' => null,
            'completion_pct' => 30,
        ])->assertOk();

        $zone->refresh();
        $this->assertSame('Z1 updated', $zone->name);

        $updatedLog = ActivityLog::query()
            ->where('target_type', 'zone')
            ->where('target_id', $zone->id)
            ->where('action', 'updated')
            ->latest('id')
            ->firstOrFail();

        $this->postJson('/api/v1/activity-logs/'.$updatedLog->id.'/rollback')
            ->assertOk()
            ->assertJsonPath('success', true);

        $zone->refresh();
        $this->assertSame('Z1', $zone->name);

        $this->assertDatabaseHas('activity_logs', [
            'target_type' => 'zone',
            'target_id' => $zone->id,
            'action' => 'restored',
            'restored_from_log_id' => $updatedLog->id,
        ]);
    }

    public function test_cannot_rollback_same_log_twice(): void
    {
        [$pm, $zone] = $this->createContext();
        Sanctum::actingAs($pm);

        $this->putJson('/api/v1/zones/'.$zone->id, [
            'name' => 'Z1 updated',
            'name_full' => null,
            'geometry_pct' => $this->geometry(),
            'assignee' => null,
            'assigned_user_id' => null,
            'deadline' => null,
            'tasks' => null,
            'notes' => null,
            'completion_pct' => 30,
        ])->assertOk();

        $updatedLog = ActivityLog::query()
            ->where('target_type', 'zone')
            ->where('target_id', $zone->id)
            ->where('action', 'updated')
            ->latest('id')
            ->firstOrFail();

        $this->postJson('/api/v1/activity-logs/'.$updatedLog->id.'/rollback')
            ->assertOk();

        $this->postJson('/api/v1/activity-logs/'.$updatedLog->id.'/rollback')
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_field_team_cannot_rollback_activity_log(): void
    {
        [$pm, $zone] = $this->createContext();
        $field = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        ProjectMember::query()->create([
            'project_id' => $zone->layer->masterLayer->project_id,
            'user_id' => $field->id,
            'role' => 'field_team',
            'created_at' => now(),
        ]);

        Sanctum::actingAs($pm);
        $this->putJson('/api/v1/zones/'.$zone->id, [
            'name' => 'Z1 updated',
            'name_full' => null,
            'geometry_pct' => $this->geometry(),
            'assignee' => null,
            'assigned_user_id' => null,
            'deadline' => null,
            'tasks' => null,
            'notes' => null,
            'completion_pct' => 30,
        ])->assertOk();

        $updatedLog = ActivityLog::query()
            ->where('target_type', 'zone')
            ->where('target_id', $zone->id)
            ->where('action', 'updated')
            ->latest('id')
            ->firstOrFail();

        Sanctum::actingAs($field);
        $this->postJson('/api/v1/activity-logs/'.$updatedLog->id.'/rollback')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    /**
     * @return array{0: User, 1: Zone}
     */
    private function createContext(): array
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
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
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 30,
            'created_by' => $pm->id,
        ]);

        ActivityLog::query()->create([
            'target_type' => 'zone',
            'target_id' => $zone->id,
            'action' => 'created',
            'snapshot_before' => null,
            'changes' => null,
            'restored_from_log_id' => null,
            'user_id' => $pm->id,
            'user_name' => (string) $pm->name,
            'created_at' => now(),
        ]);

        return [$pm, $zone];
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
