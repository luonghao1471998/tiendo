<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Repositories\UserRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserService
{
    public function __construct(private readonly UserRepository $userRepository)
    {
    }

    public function list(int $perPage = 20): LengthAwarePaginator
    {
        return $this->userRepository->paginate($perPage);
    }

    public function update(User $user, array $data): User
    {
        return $this->userRepository->update($user, [
            'name' => $data['name'],
            'email' => $data['email'],
            'is_active' => (bool) $data['is_active'],
        ]);
    }
}
