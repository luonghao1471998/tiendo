<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LayerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'master_layer_id' => $this->master_layer_id,
            'name' => $this->name,
            'code' => $this->code,
            'type' => $this->type,
            'status' => $this->status,
            'sort_order' => $this->sort_order,
            'original_filename' => $this->original_filename,
            'file_size' => $this->file_size,
            'width_px' => $this->width_px,
            'height_px' => $this->height_px,
            'tile_path' => $this->tile_path,
            'retry_count' => $this->retry_count,
            'error_message' => $this->error_message,
            'processed_at' => $this->processed_at?->toIso8601String(),
            'next_zone_seq' => $this->next_zone_seq,
            'zones_count' => (int) ($this->zones_count ?? 0),
            'uploaded_by' => $this->uploaded_by,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
