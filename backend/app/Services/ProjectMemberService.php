<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\ProjectMemberRole;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProjectMemberService
{
    /**
     * Mời / gán user vào project.
     *
     * Quy tắc PATCH-06:
     * - PM chỉ được gán role field_team | viewer (không được tạo project_manager).
     * - Admin được gán bất kỳ role.
     * - Nếu email chưa tồn tại → tạo user mới, trả temporary_password 1 lần.
     * - Nếu đã là member → 409 conflict.
     *
     * @return array{member: ProjectMember, temporary_password: string|null}
     */
    public function invite(Project $project, User $actor, array $data): array
    {
        $role = ProjectMemberRole::from($data['role']);

        // PM không được tạo project_manager
        if ($actor->role !== 'admin' && $role === ProjectMemberRole::ProjectManager) {
            throw ValidationException::withMessages([
                'role' => ['PM chỉ được gán role field_team hoặc viewer.'],
            ]);
        }

        return DB::transaction(function () use ($project, $actor, $data, $role): array {
            $email = strtolower(trim((string) $data['email']));
            $temporaryPassword = null;

            $user = User::query()->where('email', $email)->first();

            if ($user === null) {
                // Tạo user mới với temporary password
                $temporaryPassword = Str::random(12);
                $user = User::query()->create([
                    'name' => $data['name'] ?? $email,
                    'email' => $email,
                    'password' => Hash::make($temporaryPassword),
                    'role' => 'viewer',
                    'is_active' => true,
                    'must_change_password' => true,
                ]);
            }

            // Kiểm tra đã là member chưa
            $existing = ProjectMember::query()
                ->where('project_id', $project->id)
                ->where('user_id', $user->id)
                ->first();

            if ($existing !== null) {
                throw ValidationException::withMessages([
                    'email' => ['User đã là thành viên của project này.'],
                ]);
            }

            $member = ProjectMember::query()->create([
                'project_id' => $project->id,
                'user_id' => $user->id,
                'role' => $role->value,
                'created_at' => now(),
            ]);

            $member->load('user');

            return [
                'member' => $member,
                'temporary_password' => $temporaryPassword,
            ];
        });
    }

    /**
     * @return Collection<int, ProjectMember>
     */
    public function listMembers(Project $project): Collection
    {
        return ProjectMember::query()
            ->with('user')
            ->where('project_id', $project->id)
            ->orderBy('created_at')
            ->get();
    }

    /**
     * Gỡ thành viên khỏi project.
     * Không thể gỡ người tạo project.
     */
    public function removeMember(Project $project, int $userId): void
    {
        if ($project->created_by === $userId) {
            throw ValidationException::withMessages([
                'user_id' => ['Không thể gỡ người tạo project.'],
            ]);
        }

        ProjectMember::query()
            ->where('project_id', $project->id)
            ->where('user_id', $userId)
            ->delete();
    }
}
