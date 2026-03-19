<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Mark;
use App\Models\Project;
use App\Models\User;
use App\Models\Zone;

class MarkPolicy
{
    public function viewAny(User $user, Zone $zone): bool
    {
        return $this->viewsProject($user, $zone->layer->masterLayer->project);
    }

    public function create(User $user, Zone $zone): bool
    {
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

    public function updateStatus(User $user, Mark $mark): bool
    {
        if (($user->role ?? null) === 'admin') {
            return true;
        }

        $membership = $mark->zone->layer->masterLayer->project->members()
            ->where('user_id', $user->id)
            ->first();

        if ($membership === null) {
            return false;
        }

        if ($membership->role === 'project_manager') {
            return true;
        }

        if ($membership->role === 'field_team') {
            return (int) $mark->painted_by === (int) $user->id;
        }

        return false;
    }

    public function delete(User $user, Mark $mark): bool
    {
        return $this->updateStatus($user, $mark);
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
}
