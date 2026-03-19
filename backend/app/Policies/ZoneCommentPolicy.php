<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Project;
use App\Models\User;
use App\Models\Zone;
use App\Models\ZoneComment;

class ZoneCommentPolicy
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

        $project = $zone->layer->masterLayer->project;
        $membership = $project->members()->where('user_id', $user->id)->first();
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

    public function viewImage(User $user, ZoneComment $comment): bool
    {
        return $this->viewsProject($user, $comment->zone->layer->masterLayer->project);
    }

    public function delete(User $user, ZoneComment $comment): bool
    {
        if (($user->role ?? null) === 'admin') {
            return true;
        }

        $project = $comment->zone->layer->masterLayer->project;
        $membership = $project->members()->where('user_id', $user->id)->first();
        if ($membership === null) {
            return false;
        }

        if ($membership->role === 'project_manager') {
            return true;
        }

        return (int) $comment->user_id === (int) $user->id;
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
