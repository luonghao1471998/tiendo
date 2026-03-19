<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreLayerRequest;
use App\Http\Resources\LayerResource;
use App\Models\Layer;
use App\Models\MasterLayer;
use App\Services\LayerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Pattern: Controller → FormRequest → Policy → Service → Repository → Resource
 */
class LayerController extends Controller
{
    public function __construct(private readonly LayerService $layerService)
    {
    }

    /**
     * POST /api/v1/master-layers/{masterLayer}/layers
     */
    public function store(StoreLayerRequest $request, MasterLayer $masterLayer): JsonResponse
    {
        $this->authorize('upload', $masterLayer);

        /** @var \App\Models\User $user */
        $user = $request->user();

        /** @var \Illuminate\Http\UploadedFile $file */
        $file = $request->file('file');

        $layer = $this->layerService->upload($masterLayer, $user, $request->validated(), $file);

        return response()->json([
            'success' => true,
            'data' => new LayerResource($layer),
            'meta' => [
                'sync' => $this->layerService->getSyncData($layer),
            ],
        ], 201);
    }

    /**
     * GET /api/v1/layers/{layer}
     */
    public function show(Request $request, Layer $layer): JsonResponse
    {
        $this->authorize('view', $layer);

        return response()->json([
            'success' => true,
            'data' => new LayerResource($layer),
            'meta' => [
                'sync' => $this->layerService->getSyncData($layer),
            ],
        ]);
    }

    /**
     * POST /api/v1/layers/{layer}/retry
     */
    public function retry(Request $request, Layer $layer): JsonResponse
    {
        $this->authorize('retry', $layer);

        $this->layerService->retryProcessing($layer);

        $layer->refresh();

        return response()->json([
            'success' => true,
            'data' => new LayerResource($layer),
            'meta' => [
                'sync' => $this->layerService->getSyncData($layer),
            ],
        ]);
    }

    /**
     * DELETE /api/v1/layers/{layer}
     */
    public function destroy(Request $request, Layer $layer): JsonResponse
    {
        $this->authorize('delete', $layer);

        $this->layerService->delete($layer);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }

    /**
     * GET /api/v1/layers/{layer}/tiles/{z}/{x}/{y}
     */
    public function tile(Request $request, Layer $layer, int $z, int $x, int $y): BinaryFileResponse|JsonResponse
    {
        $this->authorize('view', $layer);

        if ($layer->tile_path === null || $layer->status !== 'ready') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TILES_NOT_READY',
                    'message' => 'Tiles are not available for this layer.',
                    'details' => (object) [],
                ],
            ], 404);
        }

        $filename = sprintf('%d_%d_%d.jpg', $z, $x, $y);
        $relative = rtrim($layer->tile_path, '/').'/'.$filename;
        $disk = Storage::disk('local');
        $fullPath = $disk->path($relative);

        if (! is_file($fullPath)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TILE_NOT_FOUND',
                    'message' => 'Tile not found.',
                    'details' => (object) [],
                ],
            ], 404);
        }

        return response()->file($fullPath, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
