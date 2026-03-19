<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserRepository
{
    public function paginate(int $perPage = 20): LengthAwarePaginator
    {
        return User::query()
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function update(User $user, array $data): User
    {
        $user->fill($data);
        $user->save();

        return $user;
    }
}
