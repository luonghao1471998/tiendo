<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\Zone;
use App\Models\ZoneComment;
use Illuminate\Database\Eloquent\Collection;

class ZoneCommentRepository
{
    /**
     * @return Collection<int, ZoneComment>
     */
    public function listByZone(Zone $zone): Collection
    {
        return ZoneComment::query()
            ->where('zone_id', $zone->id)
            ->with('user')
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();
    }

    public function findById(int $id): ?ZoneComment
    {
        return ZoneComment::query()->find($id);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): ZoneComment
    {
        return ZoneComment::query()->create($data);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function update(ZoneComment $comment, array $data): ZoneComment
    {
        $comment->fill($data);
        $comment->save();

        return $comment;
    }

    public function delete(ZoneComment $comment): void
    {
        $comment->delete();
    }
}
