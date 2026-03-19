<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;

class HealthController extends Controller
{
    /**
     * GET /api/v1/health
     */
    public function show(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => [
                'status' => 'ok',
            ],
        ]);
    }
}
