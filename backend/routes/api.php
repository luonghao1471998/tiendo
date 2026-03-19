<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LayerController;
use App\Http\Controllers\Api\MasterLayerController;
use App\Http\Controllers\Api\ProjectController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — Reference: Controller → FormRequest → Policy → Service → Repository → Resource
| Prefix: /api (bootstrap) + v1 below => /api/v1
|--------------------------------------------------------------------------
*/

Route::prefix('v1')->group(function (): void {
    // Auth (public)
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        // Projects (CRUD)
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::get('/projects/{project}', [ProjectController::class, 'show']);
        Route::put('/projects/{project}', [ProjectController::class, 'update']);
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

        // Master layers (nested + flat)
        Route::get('/projects/{project}/master-layers', [MasterLayerController::class, 'index']);
        Route::post('/projects/{project}/master-layers', [MasterLayerController::class, 'store']);
        Route::put('/master-layers/{masterLayer}', [MasterLayerController::class, 'update']);
        Route::delete('/master-layers/{masterLayer}', [MasterLayerController::class, 'destroy']);

        Route::post('/master-layers/{masterLayer}/layers', [LayerController::class, 'store']);
        Route::get('/layers/{layer}', [LayerController::class, 'show']);
        Route::post('/layers/{layer}/retry', [LayerController::class, 'retry']);
        Route::delete('/layers/{layer}', [LayerController::class, 'destroy']);
        Route::get('/layers/{layer}/tiles/{z}/{x}/{y}', [LayerController::class, 'tile']);
    });
});
