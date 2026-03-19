<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class ZoneResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $marksCount = $this->marks_count ?? DB::table('marks')->where('zone_id', $this->id)->count();

        return [
            'id' => $this->id,
            'layer_id' => $this->layer_id,
            'zone_code' => $this->zone_code,
            'name' => $this->name,
            'name_full' => $this->name_full,
            'geometry_pct' => $this->geometry_pct,
            'status' => $this->status,
            'completion_pct' => $this->completion_pct,
            'assignee' => $this->assignee,
            'assigned_user_id' => $this->assigned_user_id,
            'deadline' => $this->deadline?->toDateString(),
            'tasks' => $this->tasks,
            'notes' => $this->notes,
            'area_px' => $this->area_px,
            'auto_detected' => $this->auto_detected,
            'marks_count' => (int) $marksCount,
            'created_by' => $this->created_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
