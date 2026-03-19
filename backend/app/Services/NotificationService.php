<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Notification;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Zone;
use App\Repositories\NotificationRepository;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class NotificationService
{
    public function __construct(private readonly NotificationRepository $notificationRepository)
    {
    }

    public function listForUser(User $user, int $perPage = 20): LengthAwarePaginator
    {
        return $this->notificationRepository->paginateForUser($user, $perPage);
    }

    public function unreadCount(User $user): int
    {
        return $this->notificationRepository->unreadCountForUser($user);
    }

    public function getNotificationForUserOrFail(int $notificationId, User $user): Notification
    {
        $notification = $this->notificationRepository->findByIdForUser($notificationId, $user);
        if ($notification === null) {
            throw (new ModelNotFoundException())->setModel(Notification::class, [$notificationId]);
        }

        return $notification;
    }

    public function markRead(Notification $notification): Notification
    {
        return $this->notificationRepository->markRead($notification);
    }

    public function markAllRead(User $user): int
    {
        return $this->notificationRepository->markAllRead($user);
    }

    /**
     * PATCH-11: recipient + dedupe for deadline notifications.
     *
     * @return array{processed_zones: int, created_notifications: int}
     */
    public function checkDeadlines(): array
    {
        $today = now()->startOfDay()->toDateString();
        $until = now()->addDays(3)->endOfDay()->toDateString();

        $zones = Zone::query()
            ->whereNotNull('deadline')
            ->whereBetween('deadline', [$today, $until])
            ->where('status', '!=', 'completed')
            ->with(['layer.masterLayer.project'])
            ->get();

        $createdNotifications = 0;

        foreach ($zones as $zone) {
            $recipientIds = $this->resolveRecipientIds($zone);
            foreach ($recipientIds as $recipientId) {
                if ($this->hasUnreadDeadlineNotification($recipientId, (int) $zone->id)) {
                    continue;
                }

                Notification::query()->create([
                    'user_id' => $recipientId,
                    'type' => 'deadline_approaching',
                    'title' => 'Sắp đến deadline khu vực',
                    'body' => sprintf(
                        'Zone %s (%s) sắp đến hạn vào %s.',
                        (string) $zone->zone_code,
                        (string) $zone->name,
                        (string) $zone->deadline?->toDateString()
                    ),
                    'data' => [
                        'zone_id' => (int) $zone->id,
                        'layer_id' => (int) $zone->layer_id,
                        'project_id' => (int) $zone->layer->masterLayer->project_id,
                    ],
                    'read_at' => null,
                    'created_at' => now(),
                ]);

                $createdNotifications++;
            }
        }

        return [
            'processed_zones' => $zones->count(),
            'created_notifications' => $createdNotifications,
        ];
    }

    /**
     * @return list<int>
     */
    private function resolveRecipientIds(Zone $zone): array
    {
        $projectId = (int) $zone->layer->masterLayer->project_id;

        $pmIds = ProjectMember::query()
            ->where('project_id', $projectId)
            ->where('role', 'project_manager')
            ->pluck('user_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        $recipientIds = $pmIds;

        if ($zone->assigned_user_id !== null) {
            $recipientIds[] = (int) $zone->assigned_user_id;
        }

        return array_values(array_unique($recipientIds));
    }

    private function hasUnreadDeadlineNotification(int $userId, int $zoneId): bool
    {
        return Notification::query()
            ->where('user_id', $userId)
            ->where('type', 'deadline_approaching')
            ->whereNull('read_at')
            ->where('data->zone_id', $zoneId)
            ->exists();
    }
}
