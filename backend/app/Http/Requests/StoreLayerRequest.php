<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreLayerRequest extends FormRequest
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
        $maxKb = max(1, (int) floor((int) env('UPLOAD_MAX_PDF_SIZE', 52428800) / 1024));

        return [
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50'],
            'type' => ['required', 'string', 'in:architecture,electrical,mechanical,plumbing,other'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'file' => ['required', 'file', 'mimes:pdf', 'max:'.$maxKb],
        ];
    }
}
