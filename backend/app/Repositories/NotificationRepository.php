<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class NotificationRepository
{
    public function paginateForUser(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->orderByRaw('CASE WHEN read_at IS NULL THEN 0 ELSE 1 END ASC')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage);
    }

    public function unreadCountForUser(User $user): int
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();
    }

    public function findByIdForUser(int $id, User $user): ?Notification
    {
        return Notification::query()
            ->where('id', $id)
            ->where('user_id', $user->id)
            ->first();
    }

    public function markRead(Notification $notification): Notification
    {
        if ($notification->read_at === null) {
            $notification->read_at = now();
            $notification->save();
        }

        return $notification;
    }

    public function markAllRead(User $user): int
    {
        return Notification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->update([
                'read_at' => now(),
            ]);
    }
}
