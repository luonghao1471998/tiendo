<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Models\Zone;
use App\Models\ZoneComment;
use App\Repositories\ZoneCommentRepository;
use App\Repositories\ZoneRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CommentService
{
    public function __construct(
        private readonly ZoneCommentRepository $zoneCommentRepository,
        private readonly ZoneRepository $zoneRepository
    ) {
    }

    public function getZoneOrFail(int $zoneId): Zone
    {
        $zone = $this->zoneRepository->findById($zoneId);
        if ($zone === null) {
            throw (new ModelNotFoundException())->setModel(Zone::class, [$zoneId]);
        }

        return $zone;
    }

    public function getCommentOrFail(int $commentId): ZoneComment
    {
        $comment = $this->zoneCommentRepository->findById($commentId);
        if ($comment === null) {
            throw (new ModelNotFoundException())->setModel(ZoneComment::class, [$commentId]);
        }

        return $comment;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, ZoneComment>
     */
    public function listByZoneId(int $zoneId)
    {
        $zone = $this->getZoneOrFail($zoneId);

        return $this->zoneCommentRepository->listByZone($zone);
    }

    /**
     * @param array<int, UploadedFile> $images
     */
    public function create(Zone $zone, User $actor, string $content, array $images = []): ZoneComment
    {
        return DB::transaction(function () use ($zone, $actor, $content, $images) {
            $comment = $this->zoneCommentRepository->create([
                'zone_id' => $zone->id,
                'user_id' => $actor->id,
                'content' => $content,
                'images' => [],
            ]);

            $imagePaths = $this->storeImages($comment->id, $images);
            if ($imagePaths !== []) {
                $comment = $this->zoneCommentRepository->update($comment, [
                    'images' => $imagePaths,
                ]);
            }

            $this->logActivity('comment', $comment->id, 'created', null, null, $actor);

            return $comment->fresh(['user']);
        });
    }

    public function delete(ZoneComment $comment, User $actor): void
    {
        DB::transaction(function () use ($comment, $actor) {
            $comment = $comment->fresh();
            if ($comment === null) {
                return;
            }

            $snapshotBefore = $comment->toArray();
            $this->deleteImages((array) ($comment->images ?? []));
            Storage::disk('local')->deleteDirectory('comments/'.$comment->id);

            $this->zoneCommentRepository->delete($comment);
            $this->logActivity('comment', $comment->id, 'deleted', $snapshotBefore, null, $actor);
        });
    }

    /**
     * @param array<int, UploadedFile> $images
     * @return array<int, string>
     */
    private function storeImages(int $commentId, array $images): array
    {
        $disk = Storage::disk('local');
        $paths = [];

        foreach ($images as $image) {
            $extension = strtolower((string) ($image->getClientOriginalExtension() ?: $image->extension() ?: 'jpg'));
            $fileName = Str::uuid()->toString().'.'.$extension;
            $relativePath = 'comments/'.$commentId.'/'.$fileName;
            $disk->putFileAs('comments/'.$commentId, $image, $fileName);
            $paths[] = $relativePath;
        }

        return $paths;
    }

    /**
     * @param array<int, string> $imagePaths
     */
    private function deleteImages(array $imagePaths): void
    {
        if ($imagePaths === []) {
            return;
        }

        Storage::disk('local')->delete($imagePaths);
    }

    /**
     * @param array<string, mixed>|null $snapshotBefore
     * @param array<string, mixed>|null $changes
     */
    private function logActivity(
        string $targetType,
        int $targetId,
        string $action,
        ?array $snapshotBefore,
        ?array $changes,
        User $actor
    ): void {
        DB::table('activity_logs')->insert([
            'target_type' => $targetType,
            'target_id' => $targetId,
            'action' => $action,
            'snapshot_before' => $snapshotBefore ? json_encode($snapshotBefore, JSON_UNESCAPED_UNICODE) : null,
            'changes' => $changes ? json_encode($changes, JSON_UNESCAPED_UNICODE) : null,
            'restored_from_log_id' => null,
            'user_id' => $actor->id,
            'user_name' => (string) $actor->name,
            'created_at' => now(),
        ]);
    }
}
