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

class LayerListByMasterLayerTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_member_can_list_layers_by_master_layer(): void
    {
        [$member, $project] = $this->createProjectWithPm();
        $masterLayer = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'Kien truc',
            'code' => 'KT',
            'sort_order' => 1,
        ]);

        $layer = Layer::query()->create([
            'master_layer_id' => $masterLayer->id,
            'name' => 'Tang 1',
            'code' => 'T1',
            'type' => 'architecture',
            'status' => 'ready',
            'sort_order' => 1,
            'original_filename' => 't1.pdf',
            'file_path' => 'layers/1/original.pdf',
            'file_size' => 1024,
            'uploaded_by' => $member->id,
        ]);

        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'P001_KT_T1_001',
            'name' => 'Zone A',
            'status' => 'not_started',
            'completion_pct' => 0,
            'created_by' => $member->id,
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2]],
            ],
        ]);

        Sanctum::actingAs($member);
        $response = $this->getJson('/api/v1/master-layers/'.$masterLayer->id.'/layers');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.0.id', $layer->id)
            ->assertJsonPath('data.0.zones_count', 1)
            ->assertJsonPath('data.0.status', 'ready');
    }

    public function test_outsider_cannot_list_layers_by_master_layer(): void
    {
        [, $project] = $this->createProjectWithPm();

        $masterLayer = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'Dien',
            'code' => 'DIEN',
            'sort_order' => 2,
        ]);

        $outsider = User::factory()->create([
            'role' => 'viewer',
            'is_active' => true,
        ]);

        Sanctum::actingAs($outsider);
        $this->getJson('/api/v1/master-layers/'.$masterLayer->id.'/layers')
            ->assertStatus(403);
    }

    /**
     * @return array{0: User, 1: Project}
     */
    private function createProjectWithPm(): array
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $project = Project::query()->create([
            'name' => 'Step3 Project',
            'code' => 'S3P'.rand(1000, 9999),
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
}
