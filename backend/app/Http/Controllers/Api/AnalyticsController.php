<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreAnalyticsEventRequest;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;

class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analyticsService)
    {
    }

    /**
     * POST /api/v1/analytics/events
     */
    public function store(StoreAnalyticsEventRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $this->analyticsService->trackEvent(
            $user,
            $request->validated(),
            $request->ip(),
            $request->bearerToken()
        );

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ], 201);
    }
}
