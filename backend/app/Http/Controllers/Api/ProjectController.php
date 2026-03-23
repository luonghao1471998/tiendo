<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreProjectRequest;
use App\Http\Requests\UpdateProjectRequest;
use App\Http\Resources\ProjectResource;
use App\Models\Project;
use App\Services\ProjectDashboardService;
use App\Services\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Pattern: Controller → FormRequest (validate) → Policy (authorize) → Service → Repository → Resource
 */
class ProjectController extends Controller
{
    public function __construct(
        private readonly ProjectService $projectService,
        private readonly ProjectDashboardService $projectDashboardService
    ) {
    }

    /**
     * GET /api/v1/projects
     */
    public function index(Request $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $this->authorize('viewAny', Project::class);

        $perPage = (int) $request->integer('per_page', 20);
        $perPage = max(1, min($perPage, 100));

        $search = $request->query('search');
        $nameSearch = null;
        if (is_string($search)) {
            $t = trim($search);
            $nameSearch = $t !== '' ? mb_substr($t, 0, 100) : null;
        }

        $projects = $this->projectService->listForUser($user, $perPage, $nameSearch);

        return response()->json([
            'success' => true,
            'data' => ProjectResource::collection($projects),
            'meta' => [
                'current_page' => $projects->currentPage(),
                'per_page' => $projects->perPage(),
                'total' => $projects->total(),
            ],
        ]);
    }

    /**
     * POST /api/v1/projects
     */
    public function store(StoreProjectRequest $request): JsonResponse
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $this->authorize('create', Project::class);

        $project = $this->projectService->create($user, $request->validated());

        return response()->json([
            'success' => true,
            'data' => new ProjectResource($project),
        ], 201);
    }

    /**
     * GET /api/v1/projects/{project}
     */
    public function show(Request $request, Project $project): JsonResponse
    {
        $this->authorize('view', $project);
        $project->setAttribute('stats_summary', $this->projectDashboardService->getStatsSummary($project));

        return response()->json([
            'success' => true,
            'data' => new ProjectResource($project),
        ]);
    }

    /**
     * PUT /api/v1/projects/{project}
     */
    public function update(UpdateProjectRequest $request, Project $project): JsonResponse
    {
        $this->authorize('update', $project);

        $project = $this->projectService->update($project, $request->validated());

        return response()->json([
            'success' => true,
            'data' => new ProjectResource($project),
        ]);
    }

    /**
     * DELETE /api/v1/projects/{project}
     */
    public function destroy(Request $request, Project $project): JsonResponse
    {
        $this->authorize('delete', $project);

        $this->projectService->delete($project);

        return response()->json([
            'success' => true,
            'data' => (object) [],
        ]);
    }
}
