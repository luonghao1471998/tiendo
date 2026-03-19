<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Mark;
use App\Models\Zone;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

class LayerSyncRepository
{
    /**
     * @return Collection<int, Zone>
     */
    public function zonesUpdatedAfter(int $layerId, DateTimeInterface $since): Collection
    {
        return Zone::query()
            ->where('layer_id', $layerId)
            ->where('updated_at', '>', $since)
            ->withCount('marks')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return Collection<int, Mark>
     */
    public function marksUpdatedAfter(int $layerId, DateTimeInterface $since): Collection
    {
        return Mark::query()
            ->whereHas('zone', static function ($q) use ($layerId): void {
                $q->where('layer_id', $layerId);
            })
            ->where('updated_at', '>', $since)
            ->with('painter')
            ->orderBy('id')
            ->get();
    }

    /**
     * @return array{0: list<int>, 1: list<int>}
     */
    public function deletedEntityIdsAfter(int $layerId, DateTimeInterface $since): array
    {
        $rows = DB::table('sync_deletions')
            ->where('layer_id', $layerId)
            ->where('deleted_at', '>', $since)
            ->orderBy('id')
            ->get(['entity_type', 'entity_id']);

        $zoneIds = [];
        $markIds = [];

        foreach ($rows as $row) {
            if ($row->entity_type === 'zone') {
                $zoneIds[] = (int) $row->entity_id;
            } elseif ($row->entity_type === 'mark') {
                $markIds[] = (int) $row->entity_id;
            }
        }

        return [
            array_values(array_unique($zoneIds)),
            array_values(array_unique($markIds)),
        ];
    }
}
