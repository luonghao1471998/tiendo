<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShareLinkResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $base = rtrim((string) config('app.frontend_url'), '/');
        if ($base === '') {
            $base = rtrim((string) config('app.url'), '/');
        }
        $sharePath = '/share/'.$this->token;

        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'token' => $this->token,
            'url' => $base.$sharePath,
            'is_active' => $this->is_active,
            'expires_at' => $this->expires_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'created_by' => $this->created_by,
        ];
    }
}
