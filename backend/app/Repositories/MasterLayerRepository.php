<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\MasterLayer;
use App\Models\Project;
use Illuminate\Database\Eloquent\Collection;

class MasterLayerRepository
{
    /**
     * @return Collection<int, MasterLayer>
     */
    public function listForProject(Project $project): Collection
    {
        return MasterLayer::query()
            ->where('project_id', $project->id)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
    }

    public function findById(int $id): ?MasterLayer
    {
        return MasterLayer::query()->find($id);
    }

    public function existsCodeForProject(Project $project, string $code, ?int $exceptId = null): bool
    {
        $query = MasterLayer::query()
            ->where('project_id', $project->id)
            ->where('code', $code);

        if ($exceptId !== null) {
            $query->whereKeyNot($exceptId);
        }

        return $query->exists();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): MasterLayer
    {
        return MasterLayer::query()->create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(MasterLayer $masterLayer, array $data): MasterLayer
    {
        $masterLayer->fill($data);
        $masterLayer->save();

        return $masterLayer;
    }

    public function delete(MasterLayer $masterLayer): void
    {
        $masterLayer->delete();
    }
}
