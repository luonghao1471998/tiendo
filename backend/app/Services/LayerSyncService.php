<?php

declare(strict_types=1);

namespace App\Services;

use App\Http\Resources\MarkResource;
use App\Http\Resources\ZoneResource;
use App\Models\Layer;
use App\Repositories\LayerSyncRepository;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

class LayerSyncService
{
    public function __construct(private readonly LayerSyncRepository $layerSyncRepository)
    {
    }

    /**
     * PATCH-09: polling sync — strict updated_at / deleted_at &gt; since.
     *
     * @return array<string, mixed>
     */
    public function buildSyncPayload(Layer $layer, string $sinceIso): array
    {
        /** @var CarbonInterface $since */
        $since = Carbon::parse($sinceIso);

        $zones = $this->layerSyncRepository->zonesUpdatedAfter($layer->id, $since);
        $marks = $this->layerSyncRepository->marksUpdatedAfter($layer->id, $since);
        [$deletedZoneIds, $deletedMarkIds] = $this->layerSyncRepository->deletedEntityIdsAfter(
            $layer->id,
            $since
        );

        return [
            'zones' => ZoneResource::collection($zones)->resolve(),
            'marks' => MarkResource::collection($marks)->resolve(),
            'deleted_zone_ids' => $deletedZoneIds,
            'deleted_mark_ids' => $deletedMarkIds,
            'server_time' => now()->toIso8601String(),
        ];
    }
}
