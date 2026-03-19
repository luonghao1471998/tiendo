<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Layer;
use App\Models\MasterLayer;

class LayerRepository
{
    public function findById(int $id): ?Layer
    {
        return Layer::query()->find($id);
    }

    public function existsCodeForMasterLayer(MasterLayer $masterLayer, string $code, ?int $exceptLayerId = null): bool
    {
        $query = Layer::query()
            ->where('master_layer_id', $masterLayer->id)
            ->where('code', $code);

        if ($exceptLayerId !== null) {
            $query->whereKeyNot($exceptLayerId);
        }

        return $query->exists();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Layer
    {
        return Layer::query()->create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Layer $layer, array $data): Layer
    {
        $layer->fill($data);
        $layer->save();

        return $layer;
    }

    public function delete(Layer $layer): void
    {
        $layer->delete();
    }
}
