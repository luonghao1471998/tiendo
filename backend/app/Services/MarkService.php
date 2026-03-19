<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Mark;
use App\Models\User;
use App\Models\Zone;
use App\Repositories\MarkRepository;
use App\Repositories\ZoneRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

class MarkService
{
    public function __construct(
        private readonly MarkRepository $markRepository,
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

    public function getMarkOrFail(int $markId): Mark
    {
        $mark = $this->markRepository->findById($markId);
        if ($mark === null) {
            throw (new ModelNotFoundException())->setModel(Mark::class, [$markId]);
        }

        return $mark;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Mark>
     */
    public function listByZoneId(int $zoneId)
    {
        $zone = $this->getZoneOrFail($zoneId);

        return $this->markRepository->listByZone($zone);
    }

    public function create(int $zoneId, User $actor, array $data): Mark
    {
        $zone = $this->getZoneOrFail($zoneId);

        return DB::transaction(function () use ($zone, $actor, $data) {
            $mark = $this->markRepository->create([
                'zone_id' => $zone->id,
                'geometry_pct' => $data['geometry_pct'],
                'status' => $data['status'],
                'note' => $data['note'] ?? null,
                'painted_by' => $actor->id,
            ]);

            $this->logActivity('mark', $mark->id, 'created', null, null, $actor);

            return $mark->fresh();
        });
    }

    public function transitionStatus(Mark $mark, User $actor, string $status, ?string $note = null): Mark
    {
        $snapshotBefore = $mark->toArray();
        $changes = [
            'status' => ['from' => $mark->status, 'to' => $status],
        ];
        $payload = ['status' => $status];

        if ($note !== null) {
            $payload['note'] = $note;
            $changes['note'] = ['from' => $mark->note, 'to' => $note];
        }

        $mark = $this->markRepository->update($mark, $payload);
        $this->logActivity('mark', $mark->id, 'status_changed', $snapshotBefore, $changes, $actor);

        return $mark->fresh();
    }

    public function delete(Mark $mark, User $actor): void
    {
        DB::transaction(function () use ($mark, $actor) {
            $mark = $mark->fresh();
            if ($mark === null) {
                return;
            }

            $snapshotBefore = $mark->toArray();

            DB::table('sync_deletions')->insert([
                'layer_id' => $mark->zone->layer_id,
                'entity_type' => 'mark',
                'entity_id' => $mark->id,
                'deleted_at' => now(),
            ]);

            $this->markRepository->delete($mark);
            $this->logActivity('mark', $mark->id, 'deleted', $snapshotBefore, null, $actor);
        });
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
