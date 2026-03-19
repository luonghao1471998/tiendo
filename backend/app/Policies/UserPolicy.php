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

    public function update(User $user, User $target): bool
    {
        return ($user->role ?? null) === 'admin' && ($user->is_active ?? true) === true;
    }
}
