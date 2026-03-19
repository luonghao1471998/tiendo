<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ImportExcelRequest extends FormRequest
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
        $maxKb = (int) (config('app.upload_max_excel_size', 10485760) / 1024);

        return [
            'file' => [
                'required',
                'file',
                'mimes:xlsx,xls,csv',
                "max:{$maxKb}",
            ],
            'column_mapping' => ['sometimes', 'array'],
            'column_mapping.zone_code' => ['sometimes', 'integer', 'min:1'],
            'column_mapping.status' => ['sometimes', 'integer', 'min:1'],
            'column_mapping.completion_pct' => ['sometimes', 'integer', 'min:1'],
            'column_mapping.deadline' => ['sometimes', 'integer', 'min:1'],
            'column_mapping.notes' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
