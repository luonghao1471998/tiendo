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
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class ExportExcelTest extends TestCase
{
    use RefreshDatabase;

    public function test_export_layer_excel_downloads_expected_sheet_and_rows(): void
    {
        [$pm, $project, $layer] = $this->createContext();
        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_002',
            'name' => 'Khu B',
            'geometry_pct' => $this->geometry(),
            'status' => 'in_progress',
            'completion_pct' => 30,
            'assignee' => 'Nguyen Van A',
            'deadline' => '2026-03-30',
            'tasks' => 'Điện',
            'notes' => 'Gấp',
            'created_by' => $pm->id,
        ]);
        Zone::query()->create([
            'layer_id' => $layer->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'Khu A',
            'geometry_pct' => $this->geometry(),
            'status' => 'not_started',
            'completion_pct' => 0,
            'assignee' => null,
            'deadline' => null,
            'tasks' => null,
            'notes' => null,
            'created_by' => $pm->id,
        ]);

        Sanctum::actingAs($pm);
        $response = $this->get('/api/v1/layers/'.$layer->id.'/export/excel');
        $response->assertOk()->assertDownload();

        $filePath = $response->baseResponse->getFile()->getPathname();
        $spreadsheet = IOFactory::load($filePath);
        $sheet = $spreadsheet->getSheet(0);

        $this->assertSame('Zones', $sheet->getTitle());
        $this->assertSame('Mã khu vực', (string) $sheet->getCell('A1')->getValue());
        $this->assertSame('Trạng thái', (string) $sheet->getCell('C1')->getValue());

        // Sorted by zone_code ASC: 001 then 002
        $this->assertSame('PRJ_T1_KT_001', (string) $sheet->getCell('A2')->getValue());
        $this->assertSame('Chưa bắt đầu', (string) $sheet->getCell('C2')->getValue());
        $this->assertSame('PRJ_T1_KT_002', (string) $sheet->getCell('A3')->getValue());
        $this->assertSame('Đang thi công', (string) $sheet->getCell('C3')->getValue());
        $this->assertSame('30', (string) $sheet->getCell('D3')->getValue());
    }

    public function test_export_project_excel_downloads_one_sheet_per_layer_in_expected_order(): void
    {
        [$pm, $project, $layerT1Kt] = $this->createContext();

        $masterLayer2 = MasterLayer::query()->create([
            'project_id' => $project->id,
            'name' => 'ML2',
            'code' => 'T2',
            'sort_order' => 2,
        ]);
        $layerT2Me = Layer::query()->create([
            'master_layer_id' => $masterLayer2->id,
            'name' => 'L2',
            'code' => 'ME',
            'type' => 'mechanical',
            'status' => 'ready',
            'sort_order' => 1,
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

        Zone::query()->create([
            'layer_id' => $layerT1Kt->id,
            'zone_code' => 'PRJ_T1_KT_001',
            'name' => 'A',
            'geometry_pct' => $this->geometry(),
            'status' => 'completed',
            'completion_pct' => 100,
            'created_by' => $pm->id,
        ]);
        Zone::query()->create([
            'layer_id' => $layerT2Me->id,
            'zone_code' => 'PRJ_T2_ME_001',
            'name' => 'B',
            'geometry_pct' => $this->geometry(),
            'status' => 'delayed',
            'completion_pct' => 20,
            'created_by' => $pm->id,
        ]);

        Sanctum::actingAs($pm);
        $response = $this->get('/api/v1/projects/'.$project->id.'/export/excel');
        $response->assertOk()->assertDownload();

        $filePath = $response->baseResponse->getFile()->getPathname();
        $spreadsheet = IOFactory::load($filePath);

        $this->assertSame(2, $spreadsheet->getSheetCount());
        $this->assertSame('T1_KT', $spreadsheet->getSheet(0)->getTitle());
        $this->assertSame('T2_ME', $spreadsheet->getSheet(1)->getTitle());
        $this->assertSame('Hoàn thành', (string) $spreadsheet->getSheet(0)->getCell('C2')->getValue());
        $this->assertSame('Chậm tiến độ', (string) $spreadsheet->getSheet(1)->getCell('C2')->getValue());
    }

    public function test_export_requires_project_or_layer_access(): void
    {
        [$pm, $project, $layer] = $this->createContext();
        $outsider = User::factory()->create([
            'role' => 'viewer',
            'is_active' => true,
        ]);

        Sanctum::actingAs($outsider);
        $this->get('/api/v1/layers/'.$layer->id.'/export/excel')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->get('/api/v1/projects/'.$project->id.'/export/excel')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN');

        Sanctum::actingAs($pm);
        $this->get('/api/v1/layers/'.$layer->id.'/export/excel')->assertOk();
        $this->get('/api/v1/projects/'.$project->id.'/export/excel')->assertOk();
    }

    /**
     * @return array{0: User, 1: Project, 2: Layer}
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
