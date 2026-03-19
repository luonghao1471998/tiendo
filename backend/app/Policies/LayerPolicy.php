<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Layer;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\User;

class LayerPolicy
{
    public function upload(User $user, MasterLayer $masterLayer): bool
    {
        return $this->managesProject($user, $masterLayer->project);
    }

    public function view(User $user, Layer $layer): bool
    {
        return $this->viewsProject($user, $layer->masterLayer->project);
    }

    public function sync(User $user, Layer $layer): bool
    {
        return $this->view($user, $layer);
    }

    public function retry(User $user, Layer $layer): bool
    {
        return $this->managesProject($user, $layer->masterLayer->project);
    }

    public function delete(User $user, Layer $layer): bool
    {
        return $this->managesProject($user, $layer->masterLayer->project);
    }

    public function import(User $user, Layer $layer): bool
    {
        return $this->managesProject($user, $layer->masterLayer->project);
    }

    private function viewsProject(User $user, Project $project): bool
    {
        if (!$user->is_active) return false;
        if ($user->role === 'admin') return true;
        return $project->relationLoaded('members')
            ? $project->members->contains('user_id', $user->id)
            : $project->members()->where('user_id', $user->id)->exists();
    }

    private function managesProject(User $user, Project $project): bool
    {
        if (!$user->is_active) return false;
        if ($user->role === 'admin') return true;
        return $project->relationLoaded('members')
            ? $project->members->where('user_id', $user->id)
                ->where('role', 'project_manager')->isNotEmpty()
            : $project->members()->where('user_id', $user->id)
                ->where('role', 'project_manager')->exists();
    }
}
