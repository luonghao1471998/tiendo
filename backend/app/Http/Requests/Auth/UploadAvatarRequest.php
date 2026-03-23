<?php

declare(strict_types=1);

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class UploadAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $maxKb = max(1, (int) floor((int) env('UPLOAD_MAX_IMAGE_SIZE', 10485760) / 1024));

        return [
            'avatar' => ['required', 'image', 'mimes:jpeg,png,webp,gif', 'max:'.$maxKb],
        ];
    }
}
