<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return ($user->role ?? null) === 'admin' && ($user->is_active ?? true) === true;
    }

    /** Tạo user mới (không cho phép tạo admin qua API — chỉ PM / field / viewer). */
    public function create(User $user): bool
    {
        return ($user->role ?? null) === 'admin' && ($user->is_active ?? true) === true;
    }

    public function update(User $user, User $target): bool
    {
        return ($user->role ?? null) === 'admin' && ($user->is_active ?? true) === true;
    }

    /** Admin đặt lại mật khẩu user (không áp dụng cho tài khoản admin khác). */
    public function resetPassword(User $actor, User $target): bool
    {
        if (($actor->role ?? null) !== 'admin' || ($actor->is_active ?? true) !== true) {
            return false;
        }

        if (($target->role ?? null) === 'admin') {
            return false;
        }

        return true;
    }
}
