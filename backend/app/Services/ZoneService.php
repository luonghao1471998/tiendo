<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Layer;
use App\Models\User;
use App\Models\Zone;
use App\Repositories\LayerRepository;
use App\Repositories\ZoneRepository;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ZoneService
{
    public function __construct(
        private readonly ZoneRepository $zoneRepository,
        private readonly LayerRepository $layerRepository
    ) {
    }

    /**
     * @return \Illuminate\Database\Eloquent\Collection<int, Zone>
     */
    public function listByLayerId(int $layerId)
    {
        $layer = $this->getLayerOrFail($layerId);

        return $this->zoneRepository->listByLayer($layer);
    }

    public function getLayerOrFail(int $layerId): Layer
    {
        $layer = $this->layerRepository->findById($layerId);
        if ($layer === null) {
            throw (new ModelNotFoundException())->setModel(Layer::class, [$layerId]);
        }

        return $layer;
    }

    public function getZoneOrFail(int $zoneId): Zone
    {
        $zone = $this->zoneRepository->findById($zoneId);
        if ($zone === null) {
            throw (new ModelNotFoundException())->setModel(Zone::class, [$zoneId]);
        }

        return $zone;
    }

    public function create(int $layerId, User $actor, array $data): Zone
    {
        $layer = $this->getLayerOrFail($layerId);

        return DB::transaction(function () use ($layer, $actor, $data) {
            $lockedLayer = Layer::query()->whereKey($layer->id)->lockForUpdate()->firstOrFail();
            $nextSeq = ((int) $lockedLayer->next_zone_seq) + 1;

            $zoneCode = sprintf(
                '%s_%s_%s_%03d',
                strtoupper((string) $lockedLayer->masterLayer->project->code),
                strtoupper((string) $lockedLayer->masterLayer->code),
                strtoupper((string) $lockedLayer->code),
                $nextSeq
            );

            $this->layerRepository->update($lockedLayer, ['next_zone_seq' => $nextSeq]);

            $zone = $this->zoneRepository->create([
                'layer_id' => $lockedLayer->id,
                'zone_code' => $zoneCode,
                'name' => $data['name'],
                'name_full' => $data['name_full'] ?? null,
                'geometry_pct' => $data['geometry_pct'],
                'status' => 'not_started',
                'completion_pct' => 0,
                'assignee' => $data['assignee'] ?? null,
                'assigned_user_id' => $data['assigned_user_id'] ?? null,
                'deadline' => $data['deadline'] ?? null,
                'tasks' => $data['tasks'] ?? null,
                'notes' => $data['notes'] ?? null,
                'area_px' => $this->computeAreaPx($data['geometry_pct'], $lockedLayer->width_px, $lockedLayer->height_px),
                'auto_detected' => false,
                'created_by' => $actor->id,
            ]);

            $this->logActivity('zone', $zone->id, 'created', null, null, $actor);

            return $zone;
        });
    }

    public function update(Zone $zone, User $actor, array $data): Zone
    {
        $snapshotBefore = $zone->toArray();
        $payload = [
            'name' => $data['name'],
            'name_full' => $data['name_full'] ?? null,
            'assignee' => $data['assignee'] ?? null,
            'assigned_user_id' => $data['assigned_user_id'] ?? null,
            'deadline' => $data['deadline'] ?? null,
            'tasks' => $data['tasks'] ?? null,
            'notes' => $data['notes'] ?? null,
        ];

        if (array_key_exists('geometry_pct', $data)) {
            $payload['geometry_pct'] = $data['geometry_pct'];
            $payload['area_px'] = $this->computeAreaPx(
                $data['geometry_pct'],
                $zone->layer->width_px,
                $zone->layer->height_px
            );
        }

        if (array_key_exists('completion_pct', $data)) {
            $payload['completion_pct'] = $this->resolveCompletionPctForUpdate($zone, (int) $data['completion_pct']);
        } else {
            if ($zone->status === 'not_started') {
                $payload['completion_pct'] = 0;
            }
            if ($zone->status === 'completed') {
                $payload['completion_pct'] = 100;
            }
        }

        $zone = $this->zoneRepository->update($zone, $payload);

        $this->logActivity(
            'zone',
            $zone->id,
            'updated',
            $snapshotBefore,
            $this->buildChanges($snapshotBefore, $zone->fresh()->toArray()),
            $actor
        );

        return $zone->fresh();
    }

    public function transitionStatus(Zone $zone, User $actor, string $requestedStatus, ?string $note = null, ?int $completionPct = null, ?string $notes = null, ?string $deadline = null): Zone
    {
        $currentStatus = (string) $zone->status;
        $requestedStatus = (string) $requestedStatus;

        if ($requestedStatus === $currentStatus) {
            return $this->transitionInPlace($zone, $actor, $completionPct, $notes, $deadline, $note);
        }

        $role = $this->resolveProjectRole($actor, $zone);

        $allowed = $this->allowedTransitions($currentStatus, $role);
        if (! in_array($requestedStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ['INVALID_STATE_TRANSITION'],
            ]);
        }

        $snapshotBefore = $zone->toArray();
        $payload = ['status' => $requestedStatus];

        if ($requestedStatus === 'not_started') {
            $payload['completion_pct'] = 0;
        } elseif ($requestedStatus === 'completed') {
            $payload['completion_pct'] = 100;
        } elseif ($completionPct !== null) {
            $payload['completion_pct'] = $completionPct;
        }

        if ($notes !== null) {
            $payload['notes'] = $notes;
        }
        if ($deadline !== null) {
            $payload['deadline'] = $deadline;
        }

        $zone = $this->zoneRepository->update($zone, $payload);

        $changes = [
            'status' => ['from' => $currentStatus, 'to' => $requestedStatus],
        ];

        if (array_key_exists('completion_pct', $payload)) {
            $changes['completion_pct'] = [
                'from' => $snapshotBefore['completion_pct'],
                'to' => $payload['completion_pct'],
            ];
        }
        if ($note !== null && $note !== '') {
            $changes['note'] = $note;
        }

        $this->logActivity('zone', $zone->id, 'status_changed', $snapshotBefore, $changes, $actor);

        return $zone->fresh();
    }

    /**
     * Cập nhật tiến độ / ghi chú / deadline khi không đổi trạng thái (PATCH status = hiện tại).
     * Cho phép đội hiện trường dùng PATCH /zones/{id}/status thay vì PUT /zones/{id} (PUT chỉ PM/admin).
     */
    private function transitionInPlace(
        Zone $zone,
        User $actor,
        ?int $completionPct,
        ?string $notes,
        ?string $deadline,
        ?string $note
    ): Zone {
        // 100% khi đang thi công → hoàn thành zone (đội hiện trường chỉ PATCH /status, không PUT).
        if ($zone->status === 'in_progress' && $completionPct === 100) {
            return $this->transitionStatus($zone, $actor, 'completed', $note, null, $notes, $deadline);
        }

        $snapshotBefore = $zone->toArray();
        $payload = [];

        if ($completionPct !== null) {
            $payload['completion_pct'] = $this->resolveCompletionPctForUpdate($zone, $completionPct);
        }
        if ($notes !== null) {
            $payload['notes'] = $notes;
        }
        if ($deadline !== null) {
            $payload['deadline'] = $deadline;
        }

        $hasNote = $note !== null && $note !== '';

        if ($payload === [] && ! $hasNote) {
            return $zone->fresh();
        }

        if ($payload !== []) {
            $zone = $this->zoneRepository->update($zone, $payload);
        }

        $after = $zone->fresh()->toArray();
        $changes = $this->buildChanges($snapshotBefore, $after);
        if ($hasNote) {
            $changes['note'] = $note;
        }

        if ($changes !== []) {
            $this->logActivity('zone', $zone->id, 'updated', $snapshotBefore, $changes, $actor);
        }

        return $zone->fresh();
    }

    public function delete(Zone $zone, User $actor): void
    {
        DB::transaction(function () use ($zone, $actor) {
            $zone = $zone->fresh();
            if ($zone === null) {
                return;
            }

            $marks = DB::table('marks')->where('zone_id', $zone->id)->get()->map(fn ($m) => (array) $m)->all();
            $snapshotBefore = $zone->toArray();
            $snapshotBefore['marks'] = $marks;

            foreach ($marks as $mark) {
                DB::table('sync_deletions')->insert([
                    'layer_id' => $zone->layer_id,
                    'entity_type' => 'mark',
                    'entity_id' => $mark['id'],
                    'deleted_at' => now(),
                ]);
            }

            DB::table('sync_deletions')->insert([
                'layer_id' => $zone->layer_id,
                'entity_type' => 'zone',
                'entity_id' => $zone->id,
                'deleted_at' => now(),
            ]);

            $this->zoneRepository->delete($zone);
            $this->logActivity('zone', $zone->id, 'deleted', $snapshotBefore, null, $actor);
        });
    }

    private function resolveCompletionPctForUpdate(Zone $zone, int $pct): int
    {
        if ($zone->status === 'not_started') {
            return 0;
        }

        if ($zone->status === 'completed') {
            return 100;
        }

        if ($zone->status === 'in_progress' && ($pct <= 0 || $pct >= 100)) {
            throw ValidationException::withMessages([
                'completion_pct' => ['Tiến độ in_progress phải nằm trong khoảng 1-99.'],
            ]);
        }

        if (($zone->status === 'delayed' || $zone->status === 'paused') && ($pct < 0 || $pct > 99)) {
            throw ValidationException::withMessages([
                'completion_pct' => ['Tiến độ delayed/paused phải nằm trong khoảng 0-99.'],
            ]);
        }

        return $pct;
    }

    /**
     * @return array<int, string>
     */
    private function allowedTransitions(string $from, string $role): array
    {
        $map = [
            'not_started' => ['in_progress', 'delayed'],
            'in_progress' => ['completed', 'delayed', 'paused'],
            'completed' => ['in_progress'],
            'delayed' => ['in_progress', 'completed'],
            'paused' => ['in_progress', 'delayed'],
        ];

        $allowed = $map[$from] ?? [];

        if ($role === 'field_team') {
            $fieldMap = [
                'not_started' => ['in_progress'],
                // Cho phép hoàn thành khi tiến độ 100% (PATCH status hiện tại + completion 100 → service chuyển completed).
                'in_progress' => ['paused', 'completed'],
                'paused' => ['in_progress'],
                'delayed' => ['in_progress'],
                'completed' => [],
            ];

            return $fieldMap[$from] ?? [];
        }

        return $allowed;
    }

    private function resolveProjectRole(User $user, Zone $zone): string
    {
        if (($user->role ?? null) === 'admin') {
            return 'admin';
        }

        $membership = $zone->layer->masterLayer->project->members()
            ->where('user_id', $user->id)
            ->first();

        return (string) ($membership->role ?? 'viewer');
    }

    /**
     * @param array<string, mixed> $geometry
     */
    private function computeAreaPx(array $geometry, ?int $widthPx, ?int $heightPx): ?float
    {
        if ($widthPx === null || $heightPx === null) {
            return null;
        }

        $points = $geometry['points'] ?? [];
        if (! is_array($points) || count($points) < 3) {
            return null;
        }

        $sum = 0.0;
        $n = count($points);
        for ($i = 0; $i < $n; $i++) {
            $j = ($i + 1) % $n;
            $x1 = ((float) $points[$i]['x']) * $widthPx;
            $y1 = ((float) $points[$i]['y']) * $heightPx;
            $x2 = ((float) $points[$j]['x']) * $widthPx;
            $y2 = ((float) $points[$j]['y']) * $heightPx;
            $sum += ($x1 * $y2) - ($x2 * $y1);
        }

        return abs($sum) / 2.0;
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

    /**
     * @param array<string, mixed> $before
     * @param array<string, mixed> $after
     * @return array<string, mixed>
     */
    private function buildChanges(array $before, array $after): array
    {
        $changes = [];
        foreach ($after as $key => $value) {
            if (array_key_exists($key, $before) && $before[$key] !== $value) {
                $changes[$key] = ['from' => $before[$key], 'to' => $value];
            }
        }

        return $changes;
    }
}
