<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMarkRequest;
use App\Http\Requests\TransitionMarkStatusRequest;
use App\Http\Resources\MarkResource;
use App\Models\Mark;
use App\Services\MarkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarkController extends Controller
{
    public function __construct(private readonly MarkService $markService)
    {
    }

    public function index(Request $request, int $zoneId): JsonResponse
    {
        $zone = $this->markService->getZoneOrFail($zoneId);
        $this->authorize('viewAny', [Mark::class, $zone]);

        return response()->json([
            'success' => true,
            'data' => MarkResource::collection($this->markService->listByZoneId($zoneId)),
        ]);
    }

    public function store(StoreMarkRequest $request, int $zoneId): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $zone = $this->markService->getZoneOrFail($zoneId);
        $this->authorize('create', [Mark::class, $zone]);

        $mark = $this->markService->create($zoneId, $user, $request->validated());

        return response()->json([
            'success' => true,
            'data' => new MarkResource($mark),
        ], 201);
    }

    public function transitionStatus(TransitionMarkStatusRequest $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $mark = $this->markService->getMarkOrFail($id);
        $this->authorize('updateStatus', $mark);

        $mark = $this->markService->transitionStatus(
            $mark,
            $user,
            (string) $request->validated('status'),
            $request->validated('note')
        );

        return response()->json([
            'success' => true,
            'data' => new MarkResource($mark),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $mark = $this->markService->getMarkOrFail($id);
        $this->authorize('delete', $mark);
        $this->markService->delete($mark, $user);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }
}
