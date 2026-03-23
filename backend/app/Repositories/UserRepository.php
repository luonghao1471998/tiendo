<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class UserRepository
{
    public function paginate(int $perPage = 20, ?string $nameSearch = null): LengthAwarePaginator
    {
        $query = User::query()->orderByDesc('id');

        if ($nameSearch !== null && $nameSearch !== '') {
            $term = trim($nameSearch);
            if ($term !== '') {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $query->where('name', 'ilike', $like);
            }
        }

        return $query->paginate($perPage);
    }

    public function update(User $user, array $data): User
    {
        $user->fill($data);
        $user->save();

        return $user;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): User
    {
        return User::query()->create($data);
    }
}
