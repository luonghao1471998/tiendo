<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->is_active === true;
    }

    public function view(User $user, Project $project): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return $project->members()->where('user_id', $user->id)->exists();
    }

    public function create(User $user): bool
    {
        return $user->role === 'admin' && $user->is_active === true;
    }

    public function update(User $user, Project $project): bool
    {
        if ($user->role === 'admin') {
            return true;
        }

        return $project->members()
            ->where('user_id', $user->id)
            ->where('role', 'project_manager')
            ->exists();
    }

    public function delete(User $user, Project $project): bool
    {
        return $user->role === 'admin' && $user->is_active === true;
    }
}

