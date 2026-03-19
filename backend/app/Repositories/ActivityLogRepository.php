<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\ActivityLog;
use App\Models\Layer;
use App\Models\Zone;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class ActivityLogRepository
{
    /**
     * Layer-scope history: tất cả zone + mark thuộc layer, kể cả đã deleted.
     * Dùng activity_logs trực tiếp (không join zones) để giữ lại log của deleted entities.
     *
     * @return Collection<int, ActivityLog>
     */
    public function listByLayerScope(Layer $layer): Collection
    {
        // Zone IDs còn sống + đã deleted (lấy từ logs target_type='zone' snapshot)
        $liveZoneIds = DB::table('zones')
            ->where('layer_id', $layer->id)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        // Zone IDs đã deleted nhưng snapshot_before ghi layer_id
        $deletedZoneIds = DB::table('activity_logs')
            ->where('target_type', 'zone')
            ->where('action', 'deleted')
            ->whereNotNull('snapshot_before')
            ->get(['target_id', 'snapshot_before'])
            ->filter(function ($row) use ($layer): bool {
                $snap = json_decode($row->snapshot_before, true);
                if (! is_array($snap)) {
                    return false;
                }
                $layerId = $snap['layer_id'] ?? ($snap['zone']['layer_id'] ?? null);

                return (int) $layerId === (int) $layer->id;
            })
            ->pluck('target_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        $allZoneIds = array_values(array_unique(array_merge($liveZoneIds, $deletedZoneIds)));

        if ($allZoneIds === []) {
            return ActivityLog::query()->whereRaw('1=0')->get();
        }

        // Mark IDs còn sống + đã deleted (snapshot ghi zone_id)
        $liveMarkIds = DB::table('marks')
            ->whereIn('zone_id', $allZoneIds)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        $deletedMarkIds = DB::table('activity_logs')
            ->where('target_type', 'mark')
            ->where('action', 'deleted')
            ->whereNotNull('snapshot_before')
            ->get(['target_id', 'snapshot_before'])
            ->filter(function ($row) use ($allZoneIds): bool {
                $snap = json_decode($row->snapshot_before, true);
                if (! is_array($snap)) {
                    return false;
                }

                return in_array((int) ($snap['zone_id'] ?? 0), $allZoneIds, true);
            })
            ->pluck('target_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        $allMarkIds = array_values(array_unique(array_merge($liveMarkIds, $deletedMarkIds)));

        return ActivityLog::query()
            ->where(function ($query) use ($allZoneIds, $allMarkIds): void {
                $query->where(function ($q) use ($allZoneIds): void {
                    $q->where('target_type', 'zone')
                        ->whereIn('target_id', $allZoneIds);
                });
                if ($allMarkIds !== []) {
                    $query->orWhere(function ($q) use ($allMarkIds): void {
                        $q->where('target_type', 'mark')
                            ->whereIn('target_id', $allMarkIds);
                    });
                }
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();
    }

    /**
     * @return Collection<int, ActivityLog>
     */
    public function listByZoneScope(Zone $zone): Collection
    {
        $markIds = DB::table('marks')
            ->where('zone_id', $zone->id)
            ->pluck('id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        return ActivityLog::query()
            ->where(function ($query) use ($zone, $markIds): void {
                $query->where(function ($zoneQuery) use ($zone): void {
                    $zoneQuery->where('target_type', 'zone')
                        ->where('target_id', $zone->id);
                });

                if ($markIds !== []) {
                    $query->orWhere(function ($markQuery) use ($markIds): void {
                        $markQuery->where('target_type', 'mark')
                            ->whereIn('target_id', $markIds);
                    });
                }
            })
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();
    }

    public function findById(int $id): ?ActivityLog
    {
        return ActivityLog::query()->find($id);
    }

    public function hasRollbackFor(int $activityLogId): bool
    {
        return ActivityLog::query()
            ->where('restored_from_log_id', $activityLogId)
            ->exists();
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): ActivityLog
    {
        return ActivityLog::query()->create($data);
    }
}
