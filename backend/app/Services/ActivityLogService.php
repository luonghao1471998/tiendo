<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Layer;
use App\Models\Mark;
use App\Models\User;
use App\Models\Zone;
use App\Repositories\ActivityLogRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ActivityLogService
{
    public function __construct(private readonly ActivityLogRepository $activityLogRepository)
    {
    }

    public function getLayerOrFail(int $layerId): Layer
    {
        $layer = Layer::query()->find($layerId);
        if ($layer === null) {
            throw (new ModelNotFoundException())->setModel(Layer::class, [$layerId]);
        }

        return $layer;
    }

    public function getZoneOrFail(int $zoneId): Zone
    {
        $zone = Zone::query()->find($zoneId);
        if ($zone === null) {
            throw (new ModelNotFoundException())->setModel(Zone::class, [$zoneId]);
        }

        return $zone;
    }

    public function getActivityLogOrFail(int $id): ActivityLog
    {
        $activityLog = $this->activityLogRepository->findById($id);
        if ($activityLog === null) {
            throw (new ModelNotFoundException())->setModel(ActivityLog::class, [$id]);
        }

        return $activityLog;
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, ActivityLog>
     */
    public function getLayerHistory(Layer $layer)
    {
        return $this->activityLogRepository->listByLayerScope($layer);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, ActivityLog>
     */
    public function getZoneHistory(Zone $zone)
    {
        return $this->activityLogRepository->listByZoneScope($zone);
    }

    public function rollback(ActivityLog $activityLog, User $actor): void
    {
        if ($activityLog->action === 'restored') {
            throw ValidationException::withMessages([
                'rollback' => ['INVALID_ROLLBACK'],
            ]);
        }

        if ($this->activityLogRepository->hasRollbackFor($activityLog->id)) {
            throw ValidationException::withMessages([
                'rollback' => ['INVALID_ROLLBACK'],
            ]);
        }

        DB::transaction(function () use ($activityLog, $actor): void {
            $snapshotBefore = $this->captureCurrentState($activityLog);

            if ($activityLog->action === 'created') {
                $this->rollbackCreated($activityLog);
            } elseif ($activityLog->action === 'updated' || $activityLog->action === 'status_changed') {
                $this->rollbackUpdatedOrStatusChanged($activityLog);
            } elseif ($activityLog->action === 'deleted') {
                $this->rollbackDeleted($activityLog);
            } else {
                throw ValidationException::withMessages([
                    'rollback' => ['INVALID_ROLLBACK'],
                ]);
            }

            $this->activityLogRepository->create([
                'target_type' => $activityLog->target_type,
                'target_id' => $activityLog->target_id,
                'action' => 'restored',
                'snapshot_before' => $snapshotBefore,
                'changes' => null,
                'restored_from_log_id' => $activityLog->id,
                'user_id' => $actor->id,
                'user_name' => (string) $actor->name,
                'created_at' => now(),
            ]);
        });
    }

    /**
     * @return array<string, mixed>|null
     */
    private function captureCurrentState(ActivityLog $activityLog): ?array
    {
        if ($activityLog->target_type === 'zone') {
            $zone = Zone::query()->find($activityLog->target_id);
            if ($zone === null) {
                return null;
            }

            $marks = DB::table('marks')
                ->where('zone_id', $zone->id)
                ->get()
                ->map(static fn ($mark): array => (array) $mark)
                ->all();

            $snapshot = $zone->toArray();
            $snapshot['marks'] = $marks;

            return $snapshot;
        }

        if ($activityLog->target_type === 'mark') {
            $mark = Mark::query()->find($activityLog->target_id);

            return $mark?->toArray();
        }

        if ($activityLog->target_type === 'comment') {
            $comment = DB::table('zone_comments')->where('id', $activityLog->target_id)->first();

            return $comment !== null ? (array) $comment : null;
        }

        return null;
    }

    private function rollbackCreated(ActivityLog $activityLog): void
    {
        if ($activityLog->target_type === 'zone') {
            $zone = Zone::query()->find($activityLog->target_id);
            if ($zone !== null) {
                $marks = DB::table('marks')->where('zone_id', $zone->id)->pluck('id')->all();
                foreach ($marks as $markId) {
                    DB::table('sync_deletions')->insert([
                        'layer_id' => $zone->layer_id,
                        'entity_type' => 'mark',
                        'entity_id' => (int) $markId,
                        'deleted_at' => now(),
                    ]);
                }

                DB::table('sync_deletions')->insert([
                    'layer_id' => $zone->layer_id,
                    'entity_type' => 'zone',
                    'entity_id' => $zone->id,
                    'deleted_at' => now(),
                ]);

                $zone->delete();
            }

            return;
        }

        if ($activityLog->target_type === 'mark') {
            $mark = Mark::query()->find($activityLog->target_id);
            if ($mark !== null) {
                DB::table('sync_deletions')->insert([
                    'layer_id' => $mark->zone->layer_id,
                    'entity_type' => 'mark',
                    'entity_id' => $mark->id,
                    'deleted_at' => now(),
                ]);
                $mark->delete();
            }

            return;
        }

        if ($activityLog->target_type === 'comment') {
            DB::table('zone_comments')->where('id', $activityLog->target_id)->delete();

            return;
        }
    }

    private function rollbackUpdatedOrStatusChanged(ActivityLog $activityLog): void
    {
        $snapshot = (array) ($activityLog->snapshot_before ?? []);
        if ($snapshot === []) {
            throw ValidationException::withMessages([
                'rollback' => ['INVALID_ROLLBACK'],
            ]);
        }

        if ($activityLog->target_type === 'zone') {
            $zone = Zone::query()->find($activityLog->target_id);
            if ($zone === null) {
                throw ValidationException::withMessages([
                    'rollback' => ['INVALID_ROLLBACK'],
                ]);
            }

            $zone->fill($this->extractZonePayload($snapshot));
            $zone->save();

            return;
        }

        if ($activityLog->target_type === 'mark') {
            $mark = Mark::query()->find($activityLog->target_id);
            if ($mark === null) {
                throw ValidationException::withMessages([
                    'rollback' => ['INVALID_ROLLBACK'],
                ]);
            }

            $mark->fill($this->extractMarkPayload($snapshot));
            $mark->save();

            return;
        }

        if ($activityLog->target_type === 'comment') {
            DB::table('zone_comments')
                ->where('id', $activityLog->target_id)
                ->update([
                    'content' => $snapshot['content'] ?? '',
                    'images' => json_encode($snapshot['images'] ?? [], JSON_UNESCAPED_UNICODE),
                    'updated_at' => now(),
                ]);

            return;
        }
    }

    private function rollbackDeleted(ActivityLog $activityLog): void
    {
        $snapshot = (array) ($activityLog->snapshot_before ?? []);
        if ($snapshot === []) {
            throw ValidationException::withMessages([
                'rollback' => ['INVALID_ROLLBACK'],
            ]);
        }

        if ($activityLog->target_type === 'zone') {
            $zoneSnapshot = isset($snapshot['zone']) && is_array($snapshot['zone']) ? $snapshot['zone'] : $snapshot;
            $marksSnapshot = isset($snapshot['marks']) && is_array($snapshot['marks']) ? $snapshot['marks'] : [];

            if (Zone::query()->whereKey((int) $zoneSnapshot['id'])->exists()) {
                throw ValidationException::withMessages([
                    'rollback' => ['INVALID_ROLLBACK'],
                ]);
            }

            DB::table('zones')->insert($this->extractZonePayloadForInsert($zoneSnapshot));

            foreach ($marksSnapshot as $markSnapshot) {
                if (! is_array($markSnapshot) || ! isset($markSnapshot['id'])) {
                    continue;
                }
                if (DB::table('marks')->where('id', (int) $markSnapshot['id'])->exists()) {
                    continue;
                }
                DB::table('marks')->insert($this->extractMarkPayloadForInsert($markSnapshot));
            }

            return;
        }

        if ($activityLog->target_type === 'mark') {
            if (DB::table('marks')->where('id', $activityLog->target_id)->exists()) {
                throw ValidationException::withMessages([
                    'rollback' => ['INVALID_ROLLBACK'],
                ]);
            }

            DB::table('marks')->insert($this->extractMarkPayloadForInsert($snapshot));

            return;
        }

        if ($activityLog->target_type === 'comment') {
            if (DB::table('zone_comments')->where('id', $activityLog->target_id)->exists()) {
                throw ValidationException::withMessages([
                    'rollback' => ['INVALID_ROLLBACK'],
                ]);
            }

            DB::table('zone_comments')->insert([
                'id' => (int) $snapshot['id'],
                'zone_id' => (int) $snapshot['zone_id'],
                'user_id' => (int) $snapshot['user_id'],
                'content' => (string) ($snapshot['content'] ?? ''),
                'images' => json_encode($snapshot['images'] ?? [], JSON_UNESCAPED_UNICODE),
                'created_at' => $snapshot['created_at'] ?? now(),
                'updated_at' => $snapshot['updated_at'] ?? now(),
            ]);
        }
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    private function extractZonePayload(array $snapshot): array
    {
        return [
            'layer_id' => $snapshot['layer_id'],
            'zone_code' => $snapshot['zone_code'],
            'name' => $snapshot['name'],
            'name_full' => $snapshot['name_full'] ?? null,
            'geometry_pct' => $snapshot['geometry_pct'],
            'status' => $snapshot['status'],
            'completion_pct' => $snapshot['completion_pct'],
            'assignee' => $snapshot['assignee'] ?? null,
            'assigned_user_id' => $snapshot['assigned_user_id'] ?? null,
            'deadline' => $snapshot['deadline'] ?? null,
            'tasks' => $snapshot['tasks'] ?? null,
            'notes' => $snapshot['notes'] ?? null,
            'area_px' => $snapshot['area_px'] ?? null,
            'auto_detected' => $snapshot['auto_detected'] ?? false,
            'created_by' => $snapshot['created_by'],
        ];
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    private function extractZonePayloadForInsert(array $snapshot): array
    {
        $payload = $this->extractZonePayload($snapshot);
        $payload['id'] = (int) $snapshot['id'];
        $payload['created_at'] = $snapshot['created_at'] ?? now();
        $payload['updated_at'] = $snapshot['updated_at'] ?? now();

        return $payload;
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    private function extractMarkPayload(array $snapshot): array
    {
        return [
            'zone_id' => $snapshot['zone_id'],
            'geometry_pct' => $snapshot['geometry_pct'],
            'status' => $snapshot['status'],
            'note' => $snapshot['note'] ?? null,
            'painted_by' => $snapshot['painted_by'],
        ];
    }

    /**
     * @param array<string, mixed> $snapshot
     * @return array<string, mixed>
     */
    private function extractMarkPayloadForInsert(array $snapshot): array
    {
        $payload = $this->extractMarkPayload($snapshot);
        $payload['id'] = (int) $snapshot['id'];
        $payload['created_at'] = $snapshot['created_at'] ?? now();
        $payload['updated_at'] = $snapshot['updated_at'] ?? now();

        return $payload;
    }
}
