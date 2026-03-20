<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

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
        $maxImages   = (int) env('UPLOAD_MAX_IMAGES_PER_COMMENT', 5);
        $maxSizeBytes = (int) env('UPLOAD_MAX_IMAGE_SIZE', 10485760);
        $maxSizeKb   = (int) max(1, floor($maxSizeBytes / 1024));

        return [
            'content'   => ['nullable', 'string', 'max:5000'],
            'images'    => ['sometimes', 'nullable', 'array', 'max:'.$maxImages],
            'images.*'  => ['file', 'image', 'max:'.$maxSizeKb],
        ];
    }

    /**
     * Require at least content or at least one image.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $hasContent = trim((string) $this->input('content', '')) !== '';
            $hasImages  = count((array) $this->file('images', [])) > 0;

            if (! $hasContent && ! $hasImages) {
                $v->errors()->add('content', 'Vui lòng nhập nội dung hoặc đính kèm ít nhất 1 ảnh.');
            }
        });
    }
}
