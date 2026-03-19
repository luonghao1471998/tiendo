<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InviteMemberRequest;
use App\Http\Resources\ProjectMemberResource;
use App\Models\Project;
use App\Services\ProjectMemberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectMemberController extends Controller
{
    public function __construct(private readonly ProjectMemberService $memberService)
    {
    }

    /**
     * GET /projects/{project}/members
     */
    public function index(Request $request, Project $project): JsonResponse
    {
        $this->authorize('listMembers', $project);

        return response()->json([
            'success' => true,
            'data' => ProjectMemberResource::collection(
                $this->memberService->listMembers($project)
            ),
        ]);
    }

    /**
     * POST /projects/{project}/members/invite
     *
     * Body: {email, name?, role}
     * Response 201: member + temporary_password (null nếu user đã có account)
     */
    public function invite(InviteMemberRequest $request, Project $project): JsonResponse
    {
        $this->authorize('invite', $project);

        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $result = $this->memberService->invite($project, $actor, $request->validated());

        $payload = [
            'member' => new ProjectMemberResource($result['member']),
        ];

        if ($result['temporary_password'] !== null) {
            $payload['temporary_password'] = $result['temporary_password'];
        }

        return response()->json([
            'success' => true,
            'data' => $payload,
        ], 201);
    }

    /**
     * DELETE /projects/{project}/members/{userId}
     */
    public function remove(Request $request, Project $project, int $userId): JsonResponse
    {
        $this->authorize('removeMember', $project);

        $this->memberService->removeMember($project, $userId);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }
}
