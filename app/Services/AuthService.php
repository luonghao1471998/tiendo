<?php

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

        if ($user->is_active !== true) {
            throw ValidationException::withMessages([
                'email' => ['User is inactive.'],
            ]);
        }

        $minutes = (int) (env('SANCTUM_TOKEN_EXPIRATION', 10080));
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

    public function me(User $user): array
    {
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
            ->values();

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'projects' => $projects,
        ];
    }
}

