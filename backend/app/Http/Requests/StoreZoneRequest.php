<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreZoneRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:255'],
            'name_full' => ['nullable', 'string', 'max:500'],
            'geometry_pct' => ['required', 'array'],
            'geometry_pct.type' => ['required', 'string', 'in:polygon'],
            'geometry_pct.points' => ['required', 'array', 'min:3'],
            'geometry_pct.points.*.x' => ['required', 'numeric', 'between:0,1'],
            'geometry_pct.points.*.y' => ['required', 'numeric', 'between:0,1'],
            'assignee' => ['nullable', 'string', 'max:255'],
            'assigned_user_id' => ['nullable', 'integer', 'exists:users,id'],
            'deadline' => ['nullable', 'date'],
            'tasks' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ];
    }
}
