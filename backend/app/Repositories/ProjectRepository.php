<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Project;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class ProjectRepository
{
    public function paginateForUser(User $user, int $perPage = 20): LengthAwarePaginator
    {
        $query = Project::query()->orderByDesc('id');

        if (($user->role ?? null) !== 'admin') {
            $query->whereHas('members', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            });
        }

        return $query->paginate($perPage);
    }

    public function getById(int $id): ?Project
    {
        return Project::query()->find($id);
    }

    public function existsByCode(string $code): bool
    {
        return Project::query()->where('code', $code)->exists();
    }

    public function create(array $data): Project
    {
        return Project::query()->create($data);
    }

    public function update(Project $project, array $data): Project
    {
        $project->fill($data);
        $project->save();

        return $project;
    }

    public function delete(Project $project): void
    {
        $project->delete();
    }
}
