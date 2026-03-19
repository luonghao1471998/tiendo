<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Layer;
use App\Models\Project;
use App\Services\ExportService;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ExportController extends Controller
{
    public function __construct(private readonly ExportService $exportService)
    {
    }

    public function exportLayerExcel(Layer $layer): BinaryFileResponse
    {
        $this->authorize('view', $layer);

        [$path, $filename] = $this->exportService->exportLayerExcel($layer);

        return response()->download($path, $filename)->deleteFileAfterSend(true);
    }

    public function exportProjectExcel(Project $project): BinaryFileResponse
    {
        $this->authorize('view', $project);

        [$path, $filename] = $this->exportService->exportProjectExcel($project);

        return response()->download($path, $filename)->deleteFileAfterSend(true);
    }
}
