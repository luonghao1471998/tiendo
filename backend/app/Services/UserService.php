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

    public function list(int $perPage = 20, ?string $nameSearch = null): LengthAwarePaginator
    {
        return $this->userRepository->paginate($perPage, $nameSearch);
    }

    /**
     * @param  array{name: string, email: string, password: string, role: string, is_active?: bool}  $data
     *         (không cần password_confirmation — admin nhập một trường mật khẩu)
     */
    public function create(array $data): User
    {
        return $this->userRepository->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
            'role' => $data['role'],
            'is_active' => (bool) ($data['is_active'] ?? true),
            /** Admin nhập mật khẩu trực tiếp — không bắt buộc đổi lần đầu (khác lời mời / reset MK). */
            'must_change_password' => false,
        ]);
    }

    public function update(User $user, array $data): User
    {
        return $this->userRepository->update($user, [
            'name' => $data['name'],
            'email' => $data['email'],
            'is_active' => (bool) $data['is_active'],
        ]);
    }

    public function resetPassword(User $user, string $plainPassword): User
    {
        return $this->userRepository->update($user, [
            'password' => $plainPassword,
            'must_change_password' => true,
        ]);
    }
}
