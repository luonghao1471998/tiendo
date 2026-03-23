<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangeOwnPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\UploadAvatarRequest;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $authService)
    {
    }

    /**
     * POST /api/v1/auth/login
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();

        $result = $this->authService->login($data['email'], $data['password']);

        /** @var \App\Models\User $user */
        $user = $result['user'];

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $result['token'],
                'expires_at' => $result['expires_at'],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role ?? null,
                    'avatar_url' => $this->authService->avatarPublicUrl($user),
                    'must_change_password' => (bool) ($user->must_change_password ?? false),
                ],
            ],
        ], 200);
    }

    /**
     * POST /api/v1/auth/logout
     */
    public function logout(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $this->authService->logout($user);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }

    /**
     * GET /api/v1/auth/me
     */
    public function me(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        return response()->json([
            'success' => true,
            'data' => $this->authService->me($user),
        ]);
    }

    /**
     * POST /api/v1/auth/me/avatar — multipart field `avatar`
     */
    public function uploadAvatar(UploadAvatarRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $this->authService->updateAvatar($user, $request->file('avatar'));

        return response()->json([
            'success' => true,
            'data' => $this->authService->me($user->fresh()),
        ]);
    }

    /**
     * PATCH /api/v1/auth/me/password
     */
    public function changePassword(ChangeOwnPasswordRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        $data = $request->validated();
        $this->authService->changeOwnPassword($user, $data['current_password'], $data['password']);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }
}
