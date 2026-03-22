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
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ExcelImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_pm_can_upload_xlsx_and_get_preview(): void
    {
        [$pm, $layer, $zone] = $this->createContext();

        $file = $this->makeXlsx([
            ['zone_code' => $zone->zone_code, 'status' => 'Đang thi công', 'pct' => 30],
        ]);

        Sanctum::actingAs($pm);
        $response = $this->postJson('/api/v1/layers/'.$layer->id.'/import', [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'preview_ready');

        $preview = $response->json('data.preview_data');
        $this->assertCount(1, $preview);
        $this->assertTrue($preview[0]['found']);
        $this->assertEquals(strtoupper($zone->zone_code), $preview[0]['zone_code']);
        $this->assertEquals('in_progress', $preview[0]['new_status']);
        $this->assertEquals(30, $preview[0]['new_completion_pct']);
    }

    public function test_preview_marks_not_found_for_unknown_zone_code(): void
    {
        [$pm, $layer] = $this->createContext();

        $file = $this->makeXlsx([
            ['zone_code' => 'NONEXISTENT_001', 'status' => 'Đang thi công', 'pct' => 50],
        ]);

        Sanctum::actingAs($pm);
        $response = $this->postJson('/api/v1/layers/'.$layer->id.'/import', [
            'file' => $file,
        ])->assertStatus(201);

        $preview = $response->json('data.preview_data');
        $this->assertFalse($preview[0]['found']);
        $this->assertNull($preview[0]['zone_id']);
    }

    public function test_apply_updates_matched_zones_and_records_result(): void
    {
        [$pm, $layer, $zone] = $this->createContext();

        $file = $this->makeXlsx([
            ['zone_code' => $zone->zone_code, 'status' => 'Đang thi công', 'pct' => 45],
        ]);

        Sanctum::actingAs($pm);
        $importId = $this->postJson('/api/v1/layers/'.$layer->id.'/import', [
            'file' => $file,
        ])->assertStatus(201)->json('data.id');

        $applyResp = $this->postJson('/api/v1/excel-imports/'.$importId.'/apply');
        $applyResp->assertOk()
            ->assertJsonPath('data.status', 'applied')
            ->assertJsonPath('data.result_data.success_count', 1)
            ->assertJsonPath('data.result_data.not_found_count', 0);

        $zone->refresh();
        $this->assertEquals('in_progress', $zone->status);
        $this->assertEquals(45, $zone->completion_pct);

        $this->assertDatabaseHas('activity_logs', [
            'target_type' => 'zone',
            'target_id' => $zone->id,
            'action' => 'updated',
        ]);
    }

    public function test_apply_updates_assignee_from_phu_trach_column(): void
    {
        [$pm, $layer, $zone] = $this->createContext();
        $zone->update(['assignee' => 'Cũ']);

        $file = $this->makeXlsx([
            [
                'zone_code' => $zone->zone_code,
                'status' => 'Đang thi công',
                'pct' => 40,
                'assignee' => 'Đội thi công A',
            ],
        ]);

        Sanctum::actingAs($pm);
        $importId = $this->postJson('/api/v1/layers/'.$layer->id.'/import', [
            'file' => $file,
        ])->assertStatus(201)->json('data.id');

        $this->postJson('/api/v1/excel-imports/'.$importId.'/apply')->assertOk();

        $zone->refresh();
        $this->assertSame('Đội thi công A', $zone->assignee);
    }

    public function test_apply_counts_not_found_correctly(): void
    {
        [$pm, $layer, $zone] = $this->createContext();

        $file = $this->makeXlsx([
            ['zone_code' => $zone->zone_code, 'status' => 'Đang thi công', 'pct' => 20],
            ['zone_code' => 'GHOST_001', 'status' => 'Hoàn thành', 'pct' => 100],
        ]);

        Sanctum::actingAs($pm);
        $importId = $this->postJson('/api/v1/layers/'.$layer->id.'/import', [
            'file' => $file,
        ])->json('data.id');

        $this->postJson('/api/v1/excel-imports/'.$importId.'/apply')
            ->assertOk()
            ->assertJsonPath('data.result_data.success_count', 1)
            ->assertJsonPath('data.result_data.not_found_count', 1);
    }

    public function test_apply_cannot_be_called_twice(): void
    {
        [$pm, $layer, $zone] = $this->createContext();

        $file = $this->makeXlsx([
            ['zone_code' => $zone->zone_code, 'status' => 'Đang thi công', 'pct' => 10],
        ]);

        Sanctum::actingAs($pm);
        $importId = $this->postJson('/api/v1/layers/'.$layer->id.'/import', [
            'file' => $file,
        ])->json('data.id');

        $this->postJson('/api/v1/excel-imports/'.$importId.'/apply')->assertOk();
        $this->postJson('/api/v1/excel-imports/'.$importId.'/apply')
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    public function test_outsider_cannot_import(): void
    {
        [, $layer] = $this->createContext();
        $outsider = User::factory()->create(['role' => 'field_team', 'is_active' => true]);

        $file = $this->makeXlsx([['zone_code' => 'X', 'status' => 'Đang thi công', 'pct' => 10]]);

        Sanctum::actingAs($outsider);
        $this->postJson('/api/v1/layers/'.$layer->id.'/import', ['file' => $file])
            ->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------

    /**
     * @return array{0: User, 1: Layer, 2: Zone}
     */
    private function createContext(): array
    {
        $pm = User::factory()->create(['role' => 'project_manager', 'is_active' => true]);

        $project = Project::query()->create([
            'name' => 'Test',
            'code' => 'TST'.rand(100, 999),
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

        Sanctum::actingAs($pm);
        $zoneResp = $this->postJson('/api/v1/layers/'.$layer->id.'/zones', [
            'name' => 'Zone A',
            'geometry_pct' => [
                'type' => 'polygon',
                'points' => [
                    ['x' => 0.1, 'y' => 0.1],
                    ['x' => 0.2, 'y' => 0.1],
                    ['x' => 0.2, 'y' => 0.2],
                ],
            ],
        ])->assertStatus(201);

        $zone = Zone::query()->findOrFail($zoneResp->json('data.id'));

        return [$pm, $layer, $zone];
    }

    /**
     * Tạo UploadedFile .xlsx in-memory theo template export.
     *
     * @param list<array{zone_code: string, status: string, pct: int, assignee?: string, deadline?: string, notes?: string}> $dataRows
     */
    private function makeXlsx(array $dataRows): UploadedFile
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Header (giống template export)
        $sheet->fromArray([
            'Mã khu vực', 'Tên', 'Trạng thái', 'Tiến độ (%)',
            'Phụ trách', 'Deadline', 'Hạng mục', 'Ghi chú',
        ], null, 'A1');

        $row = 2;
        foreach ($dataRows as $d) {
            $sheet->fromArray([
                $d['zone_code'],
                '',
                $d['status'],
                $d['pct'],
                $d['assignee'] ?? '',
                $d['deadline'] ?? '',
                '',
                $d['notes'] ?? '',
            ], null, 'A'.$row);
            $row++;
        }

        $tmpPath = tempnam(sys_get_temp_dir(), 'import_test_').'.xlsx';
        (new Xlsx($spreadsheet))->save($tmpPath);
        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return new UploadedFile($tmpPath, 'import.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
    }
}
