<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\ProjectMemberRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class InviteMemberRequest extends FormRequest
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
            'email' => ['required', 'string', 'email', 'max:255'],
            'name' => ['sometimes', 'string', 'max:255'],
            'role' => ['required', new Enum(ProjectMemberRole::class)],
        ];
    }
}
