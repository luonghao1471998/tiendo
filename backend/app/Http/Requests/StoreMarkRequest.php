<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMarkRequest extends FormRequest
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
            'geometry_pct' => ['required', 'array'],
            'geometry_pct.type' => ['required', 'string', 'in:polygon'],
            'geometry_pct.points' => ['required', 'array', 'min:3'],
            'geometry_pct.points.*.x' => ['required', 'numeric', 'between:0,1'],
            'geometry_pct.points.*.y' => ['required', 'numeric', 'between:0,1'],
            'status' => ['required', 'string', 'in:in_progress,completed'],
            'note' => ['nullable', 'string'],
        ];
    }
}
