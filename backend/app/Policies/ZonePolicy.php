<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Layer;
use App\Models\Project;
use App\Models\User;
use App\Models\Zone;

class ZonePolicy
{
    public function viewAny(User $user, Layer $layer): bool
    {
        return $this->viewsProject($user, $layer->masterLayer->project);
    }

    public function view(User $user, Zone $zone): bool
    {
        return $this->viewsProject($user, $zone->layer->masterLayer->project);
    }

    public function create(User $user, Layer $layer): bool
    {
        return $this->managesProject($user, $layer->masterLayer->project);
    }

    public function update(User $user, Zone $zone): bool
    {
        return $this->managesProject($user, $zone->layer->masterLayer->project);
    }

    public function updateStatus(User $user, Zone $zone): bool
    {
        if (! ($user->is_active ?? true)) {
            return false;
        }

        if (($user->role ?? null) === 'admin') {
            return true;
        }

        $membership = $zone->layer->masterLayer->project->members()
            ->where('user_id', $user->id)
            ->first();

        if ($membership === null) {
            return false;
        }

        if ($membership->role === 'project_manager') {
            return true;
        }

        if ($membership->role === 'field_team') {
            return (int) $zone->assigned_user_id === (int) $user->id;
        }

        return false;
    }

    public function delete(User $user, Zone $zone): bool
    {
        return $this->managesProject($user, $zone->layer->masterLayer->project);
    }

    private function viewsProject(User $user, Project $project): bool
    {
        if (! ($user->is_active ?? true)) {
            return false;
        }

        if (($user->role ?? null) === 'admin') {
            return true;
        }

        return $project->members()->where('user_id', $user->id)->exists();
    }

    private function managesProject(User $user, Project $project): bool
    {
        if (! ($user->is_active ?? true)) {
            return false;
        }

        if (($user->role ?? null) === 'admin') {
            return true;
        }

        return $project->members()
            ->where('user_id', $user->id)
            ->where('role', 'project_manager')
            ->exists();
    }
}
