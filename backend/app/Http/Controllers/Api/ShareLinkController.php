<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateShareLinkRequest;
use App\Http\Resources\ShareLinkResource;
use App\Models\Project;
use App\Models\ShareLink;
use App\Services\ShareLinkService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\GoneHttpException;

class ShareLinkController extends Controller
{
    public function __construct(private readonly ShareLinkService $shareLinkService)
    {
    }

    /**
     * GET /projects/{project}/share-links
     */
    public function index(Request $request, Project $project): JsonResponse
    {
        $this->authorize('createShareLink', $project);

        return response()->json([
            'success' => true,
            'data' => ShareLinkResource::collection(
                $this->shareLinkService->listActive($project)
            ),
        ]);
    }

    /**
     * POST /projects/{project}/share-links
     * Body: {expires_in_days: 1|7|30}
     */
    public function store(CreateShareLinkRequest $request, Project $project): JsonResponse
    {
        $this->authorize('createShareLink', $project);

        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $shareLink = $this->shareLinkService->create(
            $project,
            $actor,
            (int) $request->input('expires_in_days')
        );

        return response()->json([
            'success' => true,
            'data' => new ShareLinkResource($shareLink),
        ], 201);
    }

    /**
     * DELETE /share-links/{id}
     */
    public function revoke(Request $request, int $id): JsonResponse
    {
        $shareLink = ShareLink::query()->findOrFail($id);
        $project = $shareLink->project()->with('members')->firstOrFail();

        $this->authorize('revokeShareLink', $project);

        $this->shareLinkService->revoke($shareLink);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }

    /**
     * GET /share/{token}  — PUBLIC (no auth required)
     * Trả về project data viewer-only nếu token hợp lệ.
     * 410 Gone nếu hết hạn/revoked.
     */
    public function resolve(string $token): JsonResponse
    {
        try {
            $result = $this->shareLinkService->resolveToken($token);
        } catch (GoneHttpException $e) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'SHARE_LINK_INVALID', 'message' => $e->getMessage()],
            ], 410);
        }

        $project = $result['project'];
        $shareLink = $result['share_link'];
        $layers = $result['layers'];

        return response()->json([
            'success' => true,
            'data' => [
                'share_link' => [
                    'token' => $shareLink->token,
                    'expires_at' => $shareLink->expires_at->toISOString(),
                    'role' => 'viewer',
                ],
                'project' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'code' => $project->code,
                    'description' => $project->description,
                    'address' => $project->address,
                ],
                'layers' => $layers->map(fn ($layer) => [
                    'id' => $layer->id,
                    'name' => $layer->name,
                    'code' => $layer->code,
                    'type' => $layer->type,
                    'status' => $layer->status,
                    'width_px' => $layer->width_px,
                    'height_px' => $layer->height_px,
                    'master_layer' => [
                        'id' => $layer->masterLayer->id,
                        'name' => $layer->masterLayer->name,
                        'code' => $layer->masterLayer->code,
                        'sort_order' => $layer->masterLayer->sort_order,
                    ],
                    'zones' => $layer->zones->map(fn ($zone) => [
                        'id' => $zone->id,
                        'zone_code' => $zone->zone_code,
                        'name' => $zone->name,
                        'geometry_pct' => $zone->geometry_pct,
                        'status' => $zone->status,
                        'completion_pct' => $zone->completion_pct,
                        'marks' => $zone->marks->map(fn ($mark) => [
                            'id' => $mark->id,
                            'geometry_pct' => $mark->geometry_pct,
                            'status' => $mark->status,
                        ])->values(),
                    ])->values(),
                ])->values(),
            ],
        ]);
    }
}
