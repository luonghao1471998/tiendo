<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
     * GET /api/v1/users
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', User::class);

        $perPage = (int) $request->integer('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        $users = $this->userService->list($perPage);

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
}
