<?php

declare(strict_types=1);

namespace App\Repositories;

use Illuminate\Support\Facades\DB;

class ProjectDashboardRepository
{
    /**
     * @return array<string, int|float>
     */
    public function getStatsSummary(int $projectId): array
    {
        $rows = DB::table('zones')
            ->join('layers', 'zones.layer_id', '=', 'layers.id')
            ->join('master_layers', 'layers.master_layer_id', '=', 'master_layers.id')
            ->where('master_layers.project_id', $projectId)
            ->selectRaw('zones.status as status, COUNT(*) as count')
            ->groupBy('zones.status')
            ->get();

        $avg = DB::table('zones')
            ->join('layers', 'zones.layer_id', '=', 'layers.id')
            ->join('master_layers', 'layers.master_layer_id', '=', 'master_layers.id')
            ->where('master_layers.project_id', $projectId)
            ->avg('zones.completion_pct');

        $stats = [
            'total_zones' => 0,
            'not_started' => 0,
            'in_progress' => 0,
            'completed' => 0,
            'delayed' => 0,
            'paused' => 0,
            'progress_pct' => $avg !== null ? round((float) $avg, 2) : 0.0,
        ];

        foreach ($rows as $row) {
            $status = (string) $row->status;
            $count = (int) $row->count;
            if (array_key_exists($status, $stats)) {
                $stats[$status] = $count;
                $stats['total_zones'] += $count;
            }
        }

        return $stats;
    }
}
