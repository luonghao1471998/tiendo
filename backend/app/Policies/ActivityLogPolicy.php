<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\ActivityLog;
use App\Models\Layer;
use App\Models\Mark;
use App\Models\Project;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Support\Facades\DB;

class ActivityLogPolicy
{
    public function rollback(User $user, ActivityLog $activityLog): bool
    {
        if (! ($user->is_active ?? true)) {
            return false;
        }

        if (($user->role ?? null) === 'admin') {
            return true;
        }

        $project = $this->resolveProject($activityLog);
        if ($project === null) {
            return false;
        }

        return $project->members()
            ->where('user_id', $user->id)
            ->where('role', 'project_manager')
            ->exists();
    }

    private function resolveProject(ActivityLog $activityLog): ?Project
    {
        if ($activityLog->target_type === 'zone') {
            $zone = Zone::query()->find($activityLog->target_id);
            if ($zone !== null) {
                return $zone->layer->masterLayer->project;
            }

            $snapshot = (array) ($activityLog->snapshot_before ?? []);
            $layerId = isset($snapshot['layer_id']) ? (int) $snapshot['layer_id'] : null;
            if ($layerId === null && isset($snapshot['zone']['layer_id'])) {
                $layerId = (int) $snapshot['zone']['layer_id'];
            }

            if ($layerId === null) {
                return null;
            }

            $layer = Layer::query()->find($layerId);

            return $layer?->masterLayer->project;
        }

        if ($activityLog->target_type === 'mark') {
            $mark = Mark::query()->find($activityLog->target_id);
            if ($mark !== null) {
                return $mark->zone->layer->masterLayer->project;
            }

            $snapshot = (array) ($activityLog->snapshot_before ?? []);
            $zoneId = isset($snapshot['zone_id']) ? (int) $snapshot['zone_id'] : null;
            if ($zoneId === null) {
                return null;
            }

            $zone = Zone::query()->find($zoneId);

            return $zone?->layer->masterLayer->project;
        }

        if ($activityLog->target_type === 'comment') {
            $row = DB::table('zone_comments')->where('id', $activityLog->target_id)->first();
            $snapshot = (array) ($activityLog->snapshot_before ?? []);
            $zoneId = $row?->zone_id ?? ($snapshot['zone_id'] ?? null);
            if ($zoneId === null) {
                return null;
            }

            $zone = Zone::query()->find((int) $zoneId);

            return $zone?->layer->masterLayer->project;
        }

        return null;
    }
}
