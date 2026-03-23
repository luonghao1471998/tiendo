<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AdminResetUserPasswordRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(private readonly UserService $userService)
    {
    }

    /**
     * POST /api/v1/users — admin tạo user (PM / field_team / viewer), bắt buộc đổi MK lần đầu.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $this->authorize('create', User::class);

        $user = $this->userService->create($request->validated());

        return response()->json([
            'success' => true,
            'data' => new UserResource($user),
        ], 201);
    }

    /**
     * GET /api/v1/users
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $perPage = (int) $request->integer('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        $search = $request->query('search');
        $nameSearch = null;
        if (is_string($search)) {
            $t = trim($search);
            $nameSearch = $t !== '' ? mb_substr($t, 0, 100) : null;
        }

        $users = $this->userService->list($perPage, $nameSearch);

        return response()->json([
            'success' => true,
            'data' => UserResource::collection($users),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * PUT /api/v1/users/{user}
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $this->authorize('update', $user);

        $user = $this->userService->update($user, $request->validated());

        return response()->json([
            'success' => true,
            'data' => new UserResource($user),
        ]);
    }

    /**
     * PATCH /api/v1/users/{user}/password — admin only, không reset admin khác
     */
    public function resetPassword(AdminResetUserPasswordRequest $request, User $user): JsonResponse
    {
        $this->authorize('resetPassword', $user);

        $this->userService->resetPassword($user, $request->validated()['password']);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }
}
