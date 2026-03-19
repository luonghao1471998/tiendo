<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Project;
use App\Models\User;
use App\Repositories\ProjectRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectService
{
    public function __construct(private readonly ProjectRepository $projectRepository)
    {
    }

    public function listForUser(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return $this->projectRepository->paginateForUser($user, $perPage);
    }

    public function create(User $actor, array $data): Project
    {
        return DB::transaction(function () use ($actor, $data) {
            $code = strtoupper((string) $data['code']);

            if ($this->projectRepository->existsByCode($code)) {
                throw ValidationException::withMessages([
                    'code' => ['Project code already exists.'],
                ]);
            }

            $project = $this->projectRepository->create([
                'name' => $data['name'],
                'code' => $code,
                'description' => $data['description'] ?? null,
                'address' => $data['address'] ?? null,
                'created_by' => $actor->id,
            ]);

            $project->members()->create([
                'user_id' => $actor->id,
                'role' => 'project_manager',
                'created_at' => now(),
            ]);

            return $project;
        });
    }

    public function update(Project $project, array $data): Project
    {
        return $this->projectRepository->update($project, [
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'address' => $data['address'] ?? null,
        ]);
    }

    public function delete(Project $project): void
    {
        $this->projectRepository->delete($project);
    }
}
