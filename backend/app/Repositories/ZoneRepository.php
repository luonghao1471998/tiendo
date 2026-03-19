<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Layer;
use App\Models\Zone;
use Illuminate\Database\Eloquent\Collection;

class ZoneRepository
{
    /**
     * @return Collection<int, Zone>
     */
    public function listByLayer(Layer $layer): Collection
    {
        return Zone::query()
            ->where('layer_id', $layer->id)
            ->orderBy('id')
            ->get();
    }

    public function findById(int $id): ?Zone
    {
        return Zone::query()->find($id);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): Zone
    {
        return Zone::query()->create($data);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(Zone $zone, array $data): Zone
    {
        $zone->fill($data);
        $zone->save();

        return $zone;
    }

    public function delete(Zone $zone): void
    {
        $zone->delete();
    }
}
