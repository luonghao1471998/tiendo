<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ImportExcelRequest;
use App\Http\Resources\ExcelImportResource;
use App\Models\ExcelImport;
use App\Models\Layer;
use App\Services\ExcelImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExcelImportController extends Controller
{
    public function __construct(private readonly ExcelImportService $importService)
    {
    }

    /**
     * POST /layers/{layer}/import
     * Upload .xlsx → parse → return preview rows.
     */
    public function upload(ImportExcelRequest $request, Layer $layer): JsonResponse
    {
        $this->authorize('import', $layer);

        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $import = $this->importService->preview(
            $layer,
            $request->file('file'),
            $actor,
            $request->input('column_mapping')
        );

        return response()->json([
            'success' => true,
            'data' => new ExcelImportResource($import),
        ], 201);
    }

    /**
     * POST /excel-imports/{id}/apply
     * Áp dụng preview đã có vào DB.
     */
    public function apply(Request $request, int $id): JsonResponse
    {
        $import = ExcelImport::query()->findOrFail($id);
        $layer = $import->layer()->with(['masterLayer.project'])->firstOrFail();

        $this->authorize('import', $layer);

        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $import = $this->importService->apply($import, $actor);

        return response()->json([
            'success' => true,
            'data' => new ExcelImportResource($import),
        ]);
    }
}
