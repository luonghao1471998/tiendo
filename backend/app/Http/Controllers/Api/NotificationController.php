<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function __construct(private readonly NotificationService $notificationService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $perPage = (int) $request->query('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        $notifications = $this->notificationService->listForUser($user, $perPage);

        return response()->json([
            'success' => true,
            'data' => NotificationResource::collection($notifications),
            'meta' => [
                'current_page' => $notifications->currentPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
            ],
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'count' => $this->notificationService->unreadCount($user),
            ],
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $notification = $this->notificationService->getNotificationForUserOrFail($id, $user);
        $notification = $this->notificationService->markRead($notification);

        return response()->json([
            'success' => true,
            'data' => new NotificationResource($notification),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $affected = $this->notificationService->markAllRead($user);

        return response()->json([
            'success' => true,
            'data' => [
                'affected' => $affected,
            ],
        ]);
    }
}
