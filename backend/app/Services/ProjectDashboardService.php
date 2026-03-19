<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Project;
use App\Repositories\ProjectDashboardRepository;

class ProjectDashboardService
{
    public function __construct(private readonly ProjectDashboardRepository $projectDashboardRepository)
    {
    }

    /**
     * @return array<string, int|float>
     */
    public function getStatsSummary(Project $project): array
    {
        return $this->projectDashboardRepository->getStatsSummary($project->id);
    }
}
