<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function login(string $email, string $password): array
    {
        /** @var User|null $user */
        $user = User::query()->where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if (isset($user->is_active) && $user->is_active !== true) {
            throw ValidationException::withMessages([
                'email' => ['User is inactive.'],
            ]);
        }

        $minutes = (int) (config('sanctum.expiration', 10080) ?: 10080);
        $expiresAt = now()->addMinutes($minutes);

        $token = $user->createToken('api', ['*'], $expiresAt);

        return [
            'token' => $token->plainTextToken,
            'expires_at' => $expiresAt->toIso8601String(),
            'user' => $user,
        ];
    }

    public function logout(User $user): void
    {
        $token = $user->currentAccessToken();
        if ($token) {
            $token->delete();
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function me(User $user): array
    {
        $projects = [];

        if (method_exists($user, 'projectMemberships')) {
            $projects = $user->projectMemberships()
                ->with('project')
                ->get()
                ->map(function ($membership) {
                    return [
                        'id' => $membership->project->id,
                        'name' => $membership->project->name,
                        'role' => $membership->role,
                    ];
                })
                ->values()
                ->all();
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?? null,
            'projects' => $projects,
        ];
    }
}
