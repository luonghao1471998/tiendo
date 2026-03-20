<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TransitionZoneStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', 'string', 'in:not_started,in_progress,completed,delayed,paused'],
            'note' => ['nullable', 'string'],
            'completion_pct' => ['nullable', 'integer', 'between:0,100'],
            'notes' => ['nullable', 'string'],
            'deadline' => ['nullable', 'date'],
        ];
    }
}
