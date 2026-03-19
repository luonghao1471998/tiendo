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

class AnalyticsDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_show_returns_stats_summary_for_dashboard(): void
    {
        [$pm, $project, $layer] = $this->createContext();

        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Z1',
            'geometry_pct' => $this->geometry(),
            'status' => 'not_started',
            'completion_pct' => 0,
            'created_by' => $pm->id,
        ]);
        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_002',
            'name' => 'Z2',
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 40,
            'created_by' => $pm->id,
        ]);
        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_003',
            'name' => 'Z3',
            'geometry_pct' => $this->geometry(),
            'status' => 'completed',
            'completion_pct' => 100,
            'created_by' => $pm->id,
        ]);

        Sanctum::actingAs($pm);
        $response = $this->getJson('/api/v1/projects/'.$project->id);
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.stats.total_zones', 3)
            ->assertJsonPath('data.stats.not_started', 1)
            ->assertJsonPath('data.stats.in_progress', 1)
            ->assertJsonPath('data.stats.completed', 1)
            ->assertJsonPath('data.stats.delayed', 0)
            ->assertJsonPath('data.stats.paused', 0)
            ->assertJsonPath('data.stats.progress_pct', 46.67);
    }

    public function test_member_can_send_analytics_event_and_store_usage_log(): void
    {
        [$pm, $project, $layer] = $this->createContext();
        Sanctum::actingAs($pm);

        $this->postJson('/api/v1/analytics/events', [
            'event_type' => 'canvas_view',
            'project_id' => $project->id,
            'layer_id' => $layer->id,
            'metadata' => [
                'zone_count' => 3,
                'mark_count' => 2,
            ],
        ])->assertStatus(201)
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('usage_logs', [
            'user_id' => $pm->id,
            'event_type' => 'canvas_view',
            'project_id' => $project->id,
            'layer_id' => $layer->id,
        ]);
    }

    public function test_analytics_event_rejects_project_without_access(): void
    {
        [$pm, $project] = $this->createContext();
        $outsider = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        Sanctum::actingAs($outsider);

        $this->postJson('/api/v1/analytics/events', [
            'event_type' => 'page_view',
            'project_id' => $project->id,
            'metadata' => ['page' => '/projects'],
        ])->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_analytics_event_validates_layer_belongs_to_project(): void
    {
        [$pm, $project] = $this->createContext();
        $otherProject = Project::query()->create([
            'name' => 'P2',
            'code' => 'PR2',
            'created_by' => $pm->id,
        ]);
        ProjectMember::query()->create([
            'project_id' => $otherProject->id,
            'user_id' => $pm->id,
            'role' => 'project_manager',
            'created_at' => now(),
        ]);
        $otherMasterLayer = MasterLayer::query()->create([
            'project_id' => $otherProject->id,
            'name' => 'ML2',
            'code' => 'T2',
            'sort_order' => 0,
        ]);
        $otherLayer = Layer::query()->create([
            'master_layer_id' => $otherMasterLayer->id,
            'name' => 'L2',
            'code' => 'ME',
            'type' => 'mechanical',
            'status' => 'ready',
            'sort_order' => 0,
            'original_filename' => 'b.pdf',
            'file_path' => 'layers/2/original.pdf',
            'tile_path' => 'layers/2/tiles',
            'file_size' => 1,
            'width_px' => 1000,
            'height_px' => 1000,
            'retry_count' => 0,
            'next_zone_seq' => 1,
            'uploaded_by' => $pm->id,
        ]);

        Sanctum::actingAs($pm);

        $this->postJson('/api/v1/analytics/events', [
            'event_type' => 'zone_click',
            'project_id' => $project->id,
            'layer_id' => $otherLayer->id,
            'metadata' => ['zone_id' => 1],
        ])->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    /**
     * @return array{0: User, 1: Project, 2: Layer}
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

        return [$pm, $project, $layer];
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
