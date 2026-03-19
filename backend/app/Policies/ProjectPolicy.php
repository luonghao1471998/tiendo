<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Project;
use App\Models\User;

class ProjectPolicy
{
    public function viewAny(User $user): bool
    {
        return ($user->is_active ?? true) === true;
    }

    public function view(User $user, Project $project): bool
    {
        if (($user->role ?? null) === 'admin') {
            return true;
        }

        return $project->relationLoaded('members')
        ? $project->members->contains('user_id', $user->id)
        : $project->members()->where('user_id', $user->id)->exists();
    }

    public function create(User $user): bool
    {
        return ($user->role ?? null) === 'admin' && ($user->is_active ?? true) === true;
    }

    public function update(User $user, Project $project): bool
    {
        if (($user->role ?? null) === 'admin') {
            return true;
        }

        return $project->members()
            ->where('user_id', $user->id)
            ->where('role', 'project_manager')
            ->exists();
    }

    public function delete(User $user, Project $project): bool
    {
        return ($user->role ?? null) === 'admin' && ($user->is_active ?? true) === true;
    }

    /**
     * Xem danh sách thành viên — mọi member trong project đều được xem.
     */
    public function listMembers(User $user, Project $project): bool
    {
        return $this->view($user, $project);
    }

    /**
     * Mời / gán thành viên vào project — admin hoặc PM của project.
     */
    public function invite(User $user, Project $project): bool
    {
        if (($user->role ?? null) === 'admin') {
            return true;
        }

        return $project->members()
            ->where('user_id', $user->id)
            ->where('role', 'project_manager')
            ->exists();
    }

    /**
     * Xóa / gỡ thành viên khỏi project — admin hoặc PM của project.
     */
    public function removeMember(User $user, Project $project): bool
    {
        return $this->invite($user, $project);
    }

    /**
     * Tạo / liệt kê share link — admin hoặc PM của project.
     */
    public function createShareLink(User $user, Project $project): bool
    {
        return $this->invite($user, $project);
    }

    public function revokeShareLink(User $user, Project $project): bool
    {
        return $this->invite($user, $project);
    }

    /**
     * Xem danh sách master layers trong project.
     */
    public function viewMasterLayers(User $user, Project $project): bool
    {
        return $this->view($user, $project);
    }

    /**
     * Quản lý master layers trong project.
     */
    public function manageMasterLayers(User $user, Project $project): bool
    {
        return $this->invite($user, $project);
    }
}
