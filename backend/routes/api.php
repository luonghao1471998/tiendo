<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\ExcelImportController;
use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\LayerController;
use App\Http\Controllers\Api\ShareLinkController;
use App\Http\Controllers\Api\MarkController;
use App\Http\Controllers\Api\MasterLayerController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\ProjectMemberController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ExportController;
use App\Http\Controllers\Api\ZoneController;
use App\Http\Controllers\Api\ZoneCommentController;
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
    Route::get('/health', [HealthController::class, 'show']);

    // Public endpoints — no auth needed (served directly by <img> tags)
    Route::get('/layers/{layer}/tiles/{z}/{x}/{y}', [LayerController::class, 'tile']);
    Route::get('/comments/{id}/images/{filename}', [ZoneCommentController::class, 'image']);

    // Share link public endpoint — không cần auth
    Route::get('/share/{token}', [ShareLinkController::class, 'resolve']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::post('/auth/me/avatar', [AuthController::class, 'uploadAvatar']);
        Route::patch('/auth/me/password', [AuthController::class, 'changePassword']);
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::patch('/users/{user}/password', [UserController::class, 'resetPassword']);
        Route::post('/analytics/events', [AnalyticsController::class, 'store']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);

        // Projects (CRUD)
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::get('/projects/{project}', [ProjectController::class, 'show']);
        Route::get('/projects/{project}/share-links', [ShareLinkController::class, 'index']);
        Route::post('/projects/{project}/share-links', [ShareLinkController::class, 'store']);
        Route::delete('/share-links/{id}', [ShareLinkController::class, 'revoke']);

        Route::get('/projects/{project}/members', [ProjectMemberController::class, 'index']);
        Route::post('/projects/{project}/members/invite', [ProjectMemberController::class, 'invite']);
        Route::delete('/projects/{project}/members/{userId}', [ProjectMemberController::class, 'remove']);
        Route::get('/projects/{project}/export/excel', [ExportController::class, 'exportProjectExcel']);
        Route::put('/projects/{project}', [ProjectController::class, 'update']);
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy']);

        // Master layers (nested + flat)
        Route::get('/projects/{project}/master-layers', [MasterLayerController::class, 'index']);
        Route::post('/projects/{project}/master-layers', [MasterLayerController::class, 'store']);
        Route::put('/master-layers/{masterLayer}', [MasterLayerController::class, 'update']);
        Route::delete('/master-layers/{masterLayer}', [MasterLayerController::class, 'destroy']);

        Route::post('/master-layers/{masterLayer}/layers', [LayerController::class, 'store']);
        Route::get('/master-layers/{masterLayer}/layers', [LayerController::class, 'index']);
        Route::get('/layers/{layer}', [LayerController::class, 'show']);
        Route::get('/layers/{layer}/export/excel', [ExportController::class, 'exportLayerExcel']);
        Route::post('/layers/{layer}/import', [ExcelImportController::class, 'upload']);
        Route::post('/excel-imports/{id}/apply', [ExcelImportController::class, 'apply']);
        Route::get('/layers/{layer}/sync', [LayerController::class, 'sync']);
        Route::post('/layers/{layer}/retry', [LayerController::class, 'retry']);
        Route::delete('/layers/{layer}', [LayerController::class, 'destroy']);

        Route::get('/layers/{layerId}/zones', [ZoneController::class, 'index']);
        Route::post('/layers/{layerId}/zones', [ZoneController::class, 'store']);
        Route::get('/zones/{id}', [ZoneController::class, 'show']);
        Route::put('/zones/{id}', [ZoneController::class, 'update']);
        Route::patch('/zones/{id}/status', [ZoneController::class, 'transitionStatus']);
        Route::delete('/zones/{id}', [ZoneController::class, 'destroy']);

        Route::get('/zones/{zoneId}/marks', [MarkController::class, 'index']);
        Route::post('/zones/{zoneId}/marks', [MarkController::class, 'store']);
        Route::patch('/marks/{id}/status', [MarkController::class, 'transitionStatus']);
        Route::delete('/marks/{id}', [MarkController::class, 'destroy']);

        Route::get('/zones/{zoneId}/comments', [ZoneCommentController::class, 'index']);
        Route::post('/zones/{zoneId}/comments', [ZoneCommentController::class, 'store']);
        Route::delete('/comments/{id}', [ZoneCommentController::class, 'destroy']);

        Route::get('/layers/{id}/history', [ActivityLogController::class, 'layerHistory']);
        Route::get('/zones/{id}/history', [ActivityLogController::class, 'zoneHistory']);
        Route::post('/activity-logs/{id}/rollback', [ActivityLogController::class, 'rollback']);
    });
});
