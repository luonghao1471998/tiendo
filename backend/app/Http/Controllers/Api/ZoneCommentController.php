<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreZoneCommentRequest;
use App\Http\Resources\ZoneCommentResource;
use App\Models\ZoneComment;
use App\Services\CommentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ZoneCommentController extends Controller
{
    public function __construct(private readonly CommentService $commentService)
    {
    }

    public function index(Request $request, int $zoneId): JsonResponse
    {
        $zone = $this->commentService->getZoneOrFail($zoneId);
        $this->authorize('viewAny', [ZoneComment::class, $zone]);

        return response()->json([
            'success' => true,
            'data' => ZoneCommentResource::collection($this->commentService->listByZoneId($zoneId)),
        ]);
    }

    public function store(StoreZoneCommentRequest $request, int $zoneId): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $zone = $this->commentService->getZoneOrFail($zoneId);
        $this->authorize('create', [ZoneComment::class, $zone]);

        /** @var array<int, \Illuminate\Http\UploadedFile> $images */
        $images = $request->file('images', []);
        $comment = $this->commentService->create(
            $zone,
            $user,
            (string) ($request->validated('content') ?? ''),
            $images
        );

        return response()->json([
            'success' => true,
            'data' => new ZoneCommentResource($comment),
        ], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $comment = $this->commentService->getCommentOrFail($id);
        $this->authorize('delete', $comment);

        $this->commentService->delete($comment, $user);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }

    public function image(Request $request, int $id, string $filename): BinaryFileResponse|JsonResponse
    {
        $comment = $this->commentService->getCommentOrFail($id);

        $allowedPath = 'comments/'.$comment->id.'/'.basename($filename);
        if (! in_array($allowedPath, (array) ($comment->images ?? []), true)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'COMMENT_IMAGE_NOT_FOUND',
                    'message' => 'Comment image not found.',
                    'details' => (object) [],
                ],
            ], 404);
        }

        $disk = Storage::disk('local');
        $fullPath = $disk->path($allowedPath);
        if (! is_file($fullPath)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'COMMENT_IMAGE_NOT_FOUND',
                    'message' => 'Comment image not found.',
                    'details' => (object) [],
                ],
            ], 404);
        }

        $mimeType = (string) ($disk->mimeType($allowedPath) ?? 'application/octet-stream');

        return response()->file($fullPath, [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
