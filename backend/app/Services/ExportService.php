<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Layer;
use App\Models\Project;
use App\Models\Zone;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

class ExportService
{
    /**
     * @return array{0: string, 1: string}
     */
    public function exportLayerExcel(Layer $layer): array
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Zones');

        $this->fillHeader($sheet);
        $this->fillRows($sheet, $this->zonesForLayer($layer));

        $filename = sprintf('layer_%d_zones.xlsx', $layer->id);
        $path = $this->writeSpreadsheet($spreadsheet, $filename);

        return [$path, $filename];
    }

    /**
     * @return array{0: string, 1: string}
     */
    public function exportProjectExcel(Project $project): array
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->removeSheetByIndex(0);

        $layers = $project->masterLayers()
            ->orderBy('sort_order')
            ->with(['layers' => function ($query): void {
                $query->orderBy('sort_order')->orderBy('id');
            }])
            ->get()
            ->flatMap(static fn ($masterLayer) => $masterLayer->layers);

        $sheetIndex = 0;
        foreach ($layers as $layer) {
            $sheet = $spreadsheet->createSheet($sheetIndex++);
            $sheet->setTitle($this->sheetNameForLayer($layer->masterLayer->code, $layer->code));
            $this->fillHeader($sheet);
            $this->fillRows($sheet, $this->zonesForLayer($layer));
        }

        if ($spreadsheet->getSheetCount() === 0) {
            $sheet = $spreadsheet->createSheet(0);
            $sheet->setTitle('Zones');
            $this->fillHeader($sheet);
        }

        $filename = sprintf('project_%d_zones.xlsx', $project->id);
        $path = $this->writeSpreadsheet($spreadsheet, $filename);

        return [$path, $filename];
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Zone>
     */
    private function zonesForLayer(Layer $layer)
    {
        return $layer->zones()
            ->orderBy('zone_code')
            ->get();
    }

    private function fillHeader($sheet): void
    {
        $sheet->fromArray([
            'Mã khu vực',
            'Tên',
            'Trạng thái',
            'Tiến độ (%)',
            'Phụ trách',
            'Deadline',
            'Hạng mục',
            'Ghi chú',
        ], null, 'A1');
    }

    /**
     * @param \Illuminate\Database\Eloquent\Collection<int, Zone> $zones
     */
    private function fillRows($sheet, $zones): void
    {
        $row = 2;
        foreach ($zones as $zone) {
            $sheet->fromArray([
                (string) $zone->zone_code,
                (string) $zone->name,
                $this->statusLabel((string) $zone->status),
                (int) $zone->completion_pct,
                $zone->assignee,
                $zone->deadline?->toDateString(),
                $zone->tasks,
                $zone->notes,
            ], null, 'A'.$row);
            $row++;
        }
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            'not_started' => 'Chưa bắt đầu',
            'in_progress' => 'Đang thi công',
            'completed' => 'Hoàn thành',
            'delayed' => 'Chậm tiến độ',
            'paused' => 'Tạm dừng',
            default => $status,
        };
    }

    private function sheetNameForLayer(string $masterLayerCode, string $layerCode): string
    {
        $name = strtoupper(trim($masterLayerCode)).'_'.strtoupper(trim($layerCode));

        return mb_substr($name, 0, 31);
    }

    private function writeSpreadsheet(Spreadsheet $spreadsheet, string $filename): string
    {
        $dir = storage_path('app/exports');
        if (! is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $path = $dir.'/'.uniqid('export_', true).'_'.$filename;
        $writer = new Xlsx($spreadsheet);
        $writer->save($path);
        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $path;
    }
}
