<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMasterLayerRequest;
use App\Http\Requests\UpdateMasterLayerRequest;
use App\Http\Resources\MasterLayerResource;
use App\Models\MasterLayer;
use App\Models\Project;
use App\Services\MasterLayerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pattern: Controller → FormRequest → Policy → Service → Repository → Resource
 */
class MasterLayerController extends Controller
{
    public function __construct(private readonly MasterLayerService $masterLayerService)
    {
    }

    /**
     * GET /api/v1/projects/{project}/master-layers
     */
    public function index(Request $request, Project $project): JsonResponse
    {
        $this->authorize('viewMasterLayers', $project);

        $layers = $this->masterLayerService->listForProject($project);

        return response()->json([
            'success' => true,
            'data' => MasterLayerResource::collection($layers),
        ]);
    }

    /**
     * POST /api/v1/projects/{project}/master-layers
     */
    public function store(StoreMasterLayerRequest $request, Project $project): JsonResponse
    {
        $this->authorize('manageMasterLayers', $project);

        $masterLayer = $this->masterLayerService->create($project, $request->validated());

        return response()->json([
            'success' => true,
            'data' => new MasterLayerResource($masterLayer),
        ], 201);
    }

    /**
     * PUT /api/v1/master-layers/{masterLayer}
     */
    public function update(UpdateMasterLayerRequest $request, MasterLayer $masterLayer): JsonResponse
    {
        $this->authorize('update', $masterLayer);

        $masterLayer = $this->masterLayerService->update($masterLayer, $request->validated());

        return response()->json([
            'success' => true,
            'data' => new MasterLayerResource($masterLayer),
        ]);
    }

    /**
     * DELETE /api/v1/master-layers/{masterLayer}
     */
    public function destroy(Request $request, MasterLayer $masterLayer): JsonResponse
    {
        $this->authorize('delete', $masterLayer);

        $this->masterLayerService->delete($masterLayer);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }
}
