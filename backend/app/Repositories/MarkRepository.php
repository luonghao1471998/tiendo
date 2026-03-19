<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Mark;
use App\Models\Zone;
use Illuminate\Database\Eloquent\Collection;

class MarkRepository
{
    /**
     * @return Collection<int, Mark>
     */
    public function listByZone(Zone $zone): Collection
    {
        return Mark::query()
            ->where('zone_id', $zone->id)
            ->orderBy('id')
            ->get();
    }

    public function findById(int $id): ?Mark
    {
        return Mark::query()->find($id);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): Mark
    {
        return Mark::query()->create($data);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(Mark $mark, array $data): Mark
    {
        $mark->fill($data);
        $mark->save();

        return $mark;
    }

    public function delete(Mark $mark): void
    {
        $mark->delete();
    }
}
