<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ExcelImportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'layer_id' => $this->layer_id,
            'filename' => $this->filename,
            'status' => $this->status,
            'preview_data' => $this->preview_data,
            'result_data' => $this->result_data,
            'imported_by' => $this->imported_by,
            'created_at' => $this->created_at?->toISOString(),
            'applied_at' => $this->applied_at?->toISOString(),
        ];
    }
}
