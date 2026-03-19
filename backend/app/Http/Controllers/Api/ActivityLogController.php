<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityLogResource;
use App\Services\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function __construct(private readonly ActivityLogService $activityLogService)
    {
    }

    public function layerHistory(Request $request, int $id): JsonResponse
    {
        $layer = $this->activityLogService->getLayerOrFail($id);
        $this->authorize('view', $layer);

        return response()->json([
            'success' => true,
            'data' => ActivityLogResource::collection($this->activityLogService->getLayerHistory($layer)),
        ]);
    }

    public function zoneHistory(Request $request, int $id): JsonResponse
    {
        $zone = $this->activityLogService->getZoneOrFail($id);
        $this->authorize('view', $zone);

        return response()->json([
            'success' => true,
            'data' => ActivityLogResource::collection($this->activityLogService->getZoneHistory($zone)),
        ]);
    }

    public function rollback(Request $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $activityLog = $this->activityLogService->getActivityLogOrFail($id);
        $this->authorize('rollback', $activityLog);

        $this->activityLogService->rollback($activityLog, $user);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }
}
