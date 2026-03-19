<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreZoneCommentRequest extends FormRequest
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
        $maxImages = (int) env('UPLOAD_MAX_IMAGES_PER_COMMENT', 5);
        $maxImageSizeBytes = (int) env('UPLOAD_MAX_IMAGE_SIZE', 10485760);
        $maxImageSizeKb = (int) max(1, floor($maxImageSizeBytes / 1024));

        return [
            'content' => ['required', 'string'],
            'images' => ['sometimes', 'array', 'max:'.$maxImages],
            'images.*' => ['file', 'image', 'max:'.$maxImageSizeKb],
        ];
    }
}
