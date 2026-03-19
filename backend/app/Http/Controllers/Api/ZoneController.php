<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreZoneRequest;
use App\Http\Requests\TransitionZoneStatusRequest;
use App\Http\Requests\UpdateZoneRequest;
use App\Http\Resources\ZoneResource;
use App\Models\Zone;
use App\Services\ZoneService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ZoneController extends Controller
{
    public function __construct(private readonly ZoneService $zoneService)
    {
    }

    public function index(Request $request, int $layerId): JsonResponse
    {
        $layer = $this->zoneService->getLayerOrFail($layerId);
        $this->authorize('viewAny', [Zone::class, $layer]);

        $zones = $this->zoneService->listByLayerId($layerId);

        return response()->json([
            'success' => true,
            'data' => ZoneResource::collection($zones),
        ]);
    }

    public function store(StoreZoneRequest $request, int $layerId): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $layer = $this->zoneService->getLayerOrFail($layerId);
        $this->authorize('create', [Zone::class, $layer]);

        $zone = $this->zoneService->create($layerId, $user, $request->validated());

        return response()->json([
            'success' => true,
            'data' => new ZoneResource($zone),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $zone = $this->zoneService->getZoneOrFail($id);
        $this->authorize('view', $zone);

        return response()->json([
            'success' => true,
            'data' => new ZoneResource($zone),
        ]);
    }

    public function update(UpdateZoneRequest $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $zone = $this->zoneService->getZoneOrFail($id);
        $this->authorize('update', $zone);

        $zone = $this->zoneService->update($zone, $user, $request->validated());

        return response()->json([
            'success' => true,
            'data' => new ZoneResource($zone),
        ]);
    }

    public function transitionStatus(TransitionZoneStatusRequest $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $zone = $this->zoneService->getZoneOrFail($id);
        $this->authorize('updateStatus', $zone);

        $zone = $this->zoneService->transitionStatus(
            $zone,
            $user,
            (string) $request->validated('status'),
            $request->validated('note')
        );

        return response()->json([
            'success' => true,
            'data' => new ZoneResource($zone),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $zone = $this->zoneService->getZoneOrFail($id);
        $this->authorize('delete', $zone);

        $this->zoneService->delete($zone, $user);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }
}
