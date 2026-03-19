<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\User;

class MasterLayerPolicy
{
    /**
     * Danh sách master layers: mọi thành viên project (và admin) được xem.
     */
    public function viewList(User $user, Project $project): bool
    {
        if (($user->is_active ?? true) !== true) {
            return false;
        }

        if (($user->role ?? null) === 'admin') {
            return true;
        }

        return $project->members()->where('user_id', $user->id)->exists();
    }

    /**
     * Tạo / sửa / xóa master layer: chỉ admin hoặc project_manager của project.
     */
    public function manage(User $user, Project $project): bool
    {
        if (($user->is_active ?? true) !== true) {
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

    public function update(User $user, MasterLayer $masterLayer): bool
    {
        return $this->manage($user, $masterLayer->project);
    }

    public function delete(User $user, MasterLayer $masterLayer): bool
    {
        return $this->manage($user, $masterLayer->project);
    }
}
