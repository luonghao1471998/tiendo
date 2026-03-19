<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use App\Repositories\LayerRepository;
use App\Repositories\ProjectRepository;
use App\Repositories\UsageLogRepository;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

class AnalyticsService
{
    public function __construct(
        private readonly UsageLogRepository $usageLogRepository,
        private readonly ProjectRepository $projectRepository,
        private readonly LayerRepository $layerRepository
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public function trackEvent(User $actor, array $data, ?string $ipAddress, ?string $sessionToken): void
    {
        $projectId = isset($data['project_id']) ? (int) $data['project_id'] : null;
        $layerId = isset($data['layer_id']) ? (int) $data['layer_id'] : null;

        if ($projectId !== null) {
            $project = $this->projectRepository->getById($projectId);
            if ($project === null) {
                throw ValidationException::withMessages([
                    'project_id' => ['Project does not exist.'],
                ]);
            }

            if (! $this->canAccessProject($actor, $projectId)) {
                throw new AuthorizationException('Forbidden');
            }
        }

        if ($layerId !== null) {
            $layer = $this->layerRepository->findById($layerId);
            if ($layer === null) {
                throw ValidationException::withMessages([
                    'layer_id' => ['Layer does not exist.'],
                ]);
            }

            $layerProjectId = (int) $layer->masterLayer->project_id;
            if (! $this->canAccessProject($actor, $layerProjectId)) {
                throw new AuthorizationException('Forbidden');
            }

            if ($projectId !== null && $projectId !== $layerProjectId) {
                throw ValidationException::withMessages([
                    'layer_id' => ['Layer does not belong to provided project.'],
                ]);
            }

            $projectId = $projectId ?? $layerProjectId;
        }

        $this->usageLogRepository->create([
            'user_id' => $actor->id,
            'session_token' => $sessionToken !== null ? substr($sessionToken, 0, 100) : null,
            'event_type' => (string) $data['event_type'],
            'project_id' => $projectId,
            'layer_id' => $layerId,
            'metadata' => $data['metadata'] ?? [],
            'ip_address' => $ipAddress,
            'created_at' => now(),
        ]);
    }

    private function canAccessProject(User $actor, int $projectId): bool
    {
        if (($actor->role ?? null) === 'admin') {
            return true;
        }

        $project = $this->projectRepository->getById($projectId);
        if ($project === null) {
            return false;
        }

        return $project->members()->where('user_id', $actor->id)->exists();
    }
}
