<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ExcelImport;
use App\Models\Layer;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ExcelImportService
{
    /**
     * Cột mặc định theo template export (1-based).
     */
    private const DEFAULT_MAPPING = [
        'zone_code' => 1,
        'status' => 3,
        'completion_pct' => 4,
        'assignee' => 5,
        'deadline' => 6,
        'notes' => 8,
    ];

    /**
     * Map label tiếng Việt → slug.
     */
    private const STATUS_FROM_LABEL = [
        'Chưa bắt đầu' => 'not_started',
        'Đang thi công' => 'in_progress',
        'Hoàn thành' => 'completed',
        'Chậm tiến độ' => 'delayed',
        'Tạm dừng' => 'paused',
        'not_started' => 'not_started',
        'in_progress' => 'in_progress',
        'completed' => 'completed',
        'delayed' => 'delayed',
        'paused' => 'paused',
    ];

    /**
     * Đọc file, preview từng dòng, lưu ExcelImport record.
     *
     * @param array<string, int>|null $columnMapping
     */
    public function preview(Layer $layer, UploadedFile $file, User $actor, ?array $columnMapping = null): ExcelImport
    {
        $mapping = $this->resolveMapping($columnMapping);
        $storedPath = $this->storeFile($file, $layer->id);
        $rows = $this->parseRows($storedPath, $mapping, $layer->id);

        return ExcelImport::query()->create([
            'layer_id' => $layer->id,
            'filename' => $file->getClientOriginalName(),
            'file_path' => $storedPath,
            'status' => 'preview_ready',
            'column_mapping' => $mapping,
            'preview_data' => $rows,
            'imported_by' => $actor->id,
            'created_at' => now(),
        ]);
    }

    /**
     * Áp dụng các thay đổi đã preview vào DB.
     */
    public function apply(ExcelImport $import, User $actor): ExcelImport
    {
        if ($import->status !== 'preview_ready') {
            throw ValidationException::withMessages([
                'import' => ['Import này không ở trạng thái preview_ready.'],
            ]);
        }

        if ($import->applied_at !== null) {
            throw ValidationException::withMessages([
                'import' => ['Import này đã được áp dụng rồi.'],
            ]);
        }

        $successCount = 0;
        $notFoundCount = 0;
        $rows = (array) $import->preview_data;

        DB::transaction(function () use ($rows, $import, &$successCount, &$notFoundCount, $actor): void {
            foreach ($rows as $row) {
                if (! ($row['found'] ?? false)) {
                    $notFoundCount++;

                    continue;
                }

                $zone = Zone::query()->find($row['zone_id']);
                if ($zone === null) {
                    $notFoundCount++;

                    continue;
                }

                $updates = [];
                $snapshotBefore = $zone->toArray();
                $changes = [];

                if (! empty($row['new_status']) && $row['new_status'] !== $row['current_status']) {
                    $updates['status'] = $row['new_status'];
                    $changes['status'] = ['from' => $row['current_status'], 'to' => $row['new_status']];
                    // Auto-set completion_pct theo state machine
                    if ($row['new_status'] === 'not_started') {
                        $updates['completion_pct'] = 0;
                    } elseif ($row['new_status'] === 'completed') {
                        $updates['completion_pct'] = 100;
                    }
                }

                if (array_key_exists('new_completion_pct', $row) && $row['new_completion_pct'] !== null) {
                    $newPct = (int) $row['new_completion_pct'];
                    $status = $updates['status'] ?? $zone->status;
                    // Chỉ apply pct nếu status cho phép
                    if (! in_array($status, ['not_started', 'completed'], true)) {
                        $updates['completion_pct'] = max(1, min(99, $newPct));
                        $changes['completion_pct'] = ['from' => $zone->completion_pct, 'to' => $updates['completion_pct']];
                    }
                }

                if (array_key_exists('new_deadline', $row) && $row['new_deadline'] !== null) {
                    $updates['deadline'] = $row['new_deadline'];
                    $changes['deadline'] = ['from' => $zone->deadline, 'to' => $row['new_deadline']];
                }

                if (array_key_exists('new_notes', $row) && $row['new_notes'] !== null) {
                    $updates['notes'] = $row['new_notes'];
                    $changes['notes'] = ['from' => $zone->notes, 'to' => $row['new_notes']];
                }

                if (array_key_exists('new_assignee', $row) && $row['new_assignee'] !== null && $row['new_assignee'] !== '') {
                    $updates['assignee'] = $row['new_assignee'];
                    $changes['assignee'] = ['from' => $zone->assignee, 'to' => $row['new_assignee']];
                }

                if ($updates !== []) {
                    $zone->update($updates);

                    DB::table('activity_logs')->insert([
                        'target_type' => 'zone',
                        'target_id' => $zone->id,
                        'action' => 'updated',
                        'user_id' => $actor->id,
                        'user_name' => $actor->name,
                        'snapshot_before' => json_encode($snapshotBefore),
                        'changes' => json_encode(array_merge($changes, ['source' => 'excel_import', 'import_id' => $import->id])),
                        'created_at' => now(),
                    ]);
                }

                $successCount++;
            }

            $import->update([
                'status' => 'applied',
                'applied_at' => now(),
                'result_data' => [
                    'success_count' => $successCount,
                    'not_found_count' => $notFoundCount,
                ],
            ]);
        });

        // Xóa file đã upload sau khi apply
        if ($import->file_path !== null) {
            Storage::disk('local')->delete($import->file_path);
        }

        return $import->fresh();
    }

    // ---------------------------------------------------------------
    // private helpers
    // ---------------------------------------------------------------

    /**
     * @param array<string, int>|null $mapping
     * @return array<string, int>
     */
    private function resolveMapping(?array $mapping): array
    {
        return array_merge(self::DEFAULT_MAPPING, $mapping ?? []);
    }

    private function storeFile(UploadedFile $file, int $layerId): string
    {
        $dir = "excel_imports/{$layerId}";
        $name = uniqid('import_', true).'.'.$file->getClientOriginalExtension();
        $file->storeAs($dir, $name, 'local');

        return "{$dir}/{$name}";
    }

    /**
     * @param array<string, int> $mapping
     * @return list<array<string, mixed>>
     */
    private function parseRows(string $storedPath, array $mapping, int $layerId): array
    {
        $absolutePath = Storage::disk('local')->path($storedPath);
        $spreadsheet = IOFactory::load($absolutePath);
        $sheet = $spreadsheet->getActiveSheet();
        $highestRow = $sheet->getHighestRow();

        // Index zones trong layer theo zone_code (uppercase, trimmed)
        $zones = Zone::query()
            ->where('layer_id', $layerId)
            ->get()
            ->keyBy(static fn (Zone $z): string => strtoupper(trim((string) $z->zone_code)));

        $rows = [];
        for ($r = 2; $r <= $highestRow; $r++) {
            $rawCode = $sheet->getCell([$mapping['zone_code'], $r])->getValue();
            if ($rawCode === null || trim((string) $rawCode) === '') {
                continue;
            }

            $normalizedCode = strtoupper(trim((string) $rawCode));
            /** @var Zone|null $zone */
            $zone = $zones->get($normalizedCode);

            $rawStatus = $sheet->getCell([$mapping['status'], $r])->getValue();
            $newStatus = $this->parseStatus($rawStatus);

            $rawPct = $sheet->getCell([$mapping['completion_pct'], $r])->getValue();
            $newPct = ($rawPct !== null && is_numeric($rawPct)) ? (int) $rawPct : null;

            $rawDeadline = $sheet->getCell([$mapping['deadline'], $r])->getValue();
            $newDeadline = $this->parseDeadline($rawDeadline);

            $rawNotes = $sheet->getCell([$mapping['notes'], $r])->getValue();
            $newNotes = ($rawNotes !== null && trim((string) $rawNotes) !== '') ? trim((string) $rawNotes) : null;

            $rawAssignee = $sheet->getCell([$mapping['assignee'], $r])->getValue();
            $newAssignee = ($rawAssignee !== null && trim((string) $rawAssignee) !== '') ? trim((string) $rawAssignee) : null;

            $rows[] = [
                'row' => $r,
                'zone_code' => $normalizedCode,
                'found' => $zone !== null,
                'zone_id' => $zone?->id,
                'match_type' => $zone !== null ? 'exact' : null,
                'current_status' => $zone?->status,
                'new_status' => $newStatus,
                'current_completion_pct' => $zone?->completion_pct,
                'new_completion_pct' => $newPct,
                'current_assignee' => $zone?->assignee,
                'new_assignee' => $newAssignee,
                'new_deadline' => $newDeadline,
                'new_notes' => $newNotes,
            ];
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $rows;
    }

    private function parseStatus(mixed $raw): ?string
    {
        if ($raw === null) {
            return null;
        }
        $trimmed = trim((string) $raw);

        return self::STATUS_FROM_LABEL[$trimmed] ?? null;
    }

    private function parseDeadline(mixed $raw): ?string
    {
        if ($raw === null) {
            return null;
        }

        // PhpSpreadsheet trả số nguyên (Excel serial) hoặc string
        if (is_numeric($raw)) {
            try {
                $date = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $raw);

                return $date->format('Y-m-d');
            } catch (\Throwable) {
                return null;
            }
        }

        $trimmed = trim((string) $raw);
        if ($trimmed === '') {
            return null;
        }

        $ts = strtotime($trimmed);

        return $ts !== false ? date('Y-m-d', $ts) : null;
    }
}
