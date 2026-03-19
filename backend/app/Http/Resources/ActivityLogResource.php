<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ActivityLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'target_type' => $this->target_type,
            'target_id' => $this->target_id,
            'action' => $this->action,
            'snapshot_before' => $this->snapshot_before,
            'changes' => $this->changes,
            'restored_from_log_id' => $this->restored_from_log_id,
            'user_id' => $this->user_id,
            'user_name' => $this->user_name,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
