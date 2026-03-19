<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Layer;
use App\Models\Mark;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LayerSyncTest extends TestCase
{
    use RefreshDatabase;

    public function test_sync_requires_since_query_parameter(): void
    {
        [$pm, $layer] = $this->createPmWithLayer();
        Sanctum::actingAs($pm);

        $this->getJson('/api/v1/layers/'.$layer->id.'/sync')
            ->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_returns_zones_and_marks_updated_strictly_after_since(): void
    {
        [$pm, $layer, $zone] = $this->createPmWithLayerAndZone();
        Sanctum::actingAs($pm);

        $oldSince = now()->subDay()->toIso8601String();

        $r = $this->getJson('/api/v1/layers/'.$layer->id.'/sync?since='.urlencode($oldSince));
        $r->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.zones.0.id', $zone->id);

        $zone->refresh();
        $exactSince = $zone->updated_at->toIso8601String();

        $this->getJson('/api/v1/layers/'.$layer->id.'/sync?since='.urlencode($exactSince))
            ->assertOk()
            ->assertJsonPath('data.zones', []);

        $this->travel(1)->seconds();

        $zone->update(['name' => 'Renamed']);

        $this->getJson('/api/v1/layers/'.$layer->id.'/sync?since='.urlencode($exactSince))
            ->assertOk()
            ->assertJsonPath('data.zones.0.name', 'Renamed');
    }

    public function test_returns_deleted_zone_and_mark_ids_after_since(): void
    {
        [$pm, $layer, $zone] = $this->createPmWithLayerAndZone();
        Sanctum::actingAs($pm);

        $mark = Mark::query()->create([
            'zone_id' => $zone->id,
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.2, 'y' => 0.2],
                    ['x' => 0.3, 'y' => 0.2],
                    ['x' => 0.3, 'y' => 0.3],
                ],
            ],
            'status' => 'in_progress',
            'painted_by' => $pm->id,
        ]);

        $sinceBefore = now()->subMinute()->toIso8601String();

        $this->deleteJson('/api/v1/marks/'.$mark->id)->assertOk();

        $syncMark = $this->getJson(
            '/api/v1/layers/'.$layer->id.'/sync?since='.urlencode($sinceBefore)
        );
        $syncMark->assertOk()
            ->assertJsonPath('data.deleted_mark_ids.0', $mark->id);

        $zone2 = Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_002',
            'name' => 'Z2',
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.1, 'y' => 0.1],
                    ['x' => 0.2, 'y' => 0.1],
                    ['x' => 0.2, 'y' => 0.2],
                ],
            ],
            'status' => 'in_progress',
            'completion_pct' => 10,
            'assigned_user_id' => null,
            'created_by' => $pm->id,
        ]);

        $sinceBeforeZoneDelete = now()->toIso8601String();
        $this->travel(2)->seconds();

        $this->deleteJson('/api/v1/zones/'.$zone2->id)->assertOk();

        $this->getJson(
            '/api/v1/layers/'.$layer->id.'/sync?since='.urlencode($sinceBeforeZoneDelete)
        )->assertOk()
            ->assertJsonPath('data.deleted_zone_ids.0', $zone2->id);
    }

    public function test_non_project_member_cannot_sync(): void
    {
        [$pm, $layer] = $this->createPmWithLayer();
        $outsider = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        Sanctum::actingAs($outsider);

        $this->getJson(
            '/api/v1/layers/'.$layer->id.'/sync?since='.urlencode(now()->subHour()->toIso8601String())
        )->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    /**
     * @return array{0: User, 1: Layer}
     */
    private function createPmWithLayer(): array
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

        return [$pm, $layer];
    }

    /**
     * @return array{0: User, 1: Layer, 2: Zone}
     */
    private function createPmWithLayerAndZone(): array
    {
        [$pm, $layer] = $this->createPmWithLayer();

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
            'assigned_user_id' => null,
            'created_by' => $pm->id,
        ]);

        return [$pm, $layer, $zone];
    }
}
