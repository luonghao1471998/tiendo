<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\MasterLayer;
use App\Models\Project;
use App\Repositories\MasterLayerRepository;
use Illuminate\Validation\ValidationException;

class MasterLayerService
{
    public function __construct(private readonly MasterLayerRepository $masterLayerRepository)
    {
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, MasterLayer>
     */
    public function listForProject(Project $project)
    {
        return $this->masterLayerRepository->listForProject($project);
    }

    public function create(Project $project, array $data): MasterLayer
    {
        $code = strtoupper((string) $data['code']);

        if ($this->masterLayerRepository->existsCodeForProject($project, $code)) {
            throw ValidationException::withMessages([
                'code' => ['Mã mặt bằng đã tồn tại trong dự án.'],
            ]);
        }

        return $this->masterLayerRepository->create([
            'project_id' => $project->id,
            'name' => $data['name'],
            'code' => $code,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);
    }

    public function update(MasterLayer $masterLayer, array $data): MasterLayer
    {
        $payload = [
            'name' => $data['name'],
        ];

        if (array_key_exists('sort_order', $data) && $data['sort_order'] !== null) {
            $payload['sort_order'] = (int) $data['sort_order'];
        }

        return $this->masterLayerRepository->update($masterLayer, $payload);
    }

    /**
     * DB cascade: master_layers → layers → zones → marks (FK cascadeOnDelete).
     */
    public function delete(MasterLayer $masterLayer): void
    {
        $this->masterLayerRepository->delete($masterLayer);
    }
}
