<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\UsageLog;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TrackUsage
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if (! $request->is('api/*')) {
            return $response;
        }

        if ($response->getStatusCode() < 200 || $response->getStatusCode() >= 300) {
            return $response;
        }

        if ($request->isMethod('POST') && $request->path() === 'api/v1/auth/login') {
            $this->trackLogin($request, $response);

            return $response;
        }

        if ($request->isMethod('POST') && $request->path() === 'api/v1/analytics/events') {
            return $response;
        }

        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $this->trackApiMutation($request, $response);
        }

        return $response;
    }

    private function trackLogin(Request $request, Response $response): void
    {
        /** @var array<string, mixed>|null $payload */
        $payload = json_decode($response->getContent() ?: '', true);
        if (! is_array($payload)) {
            return;
        }

        $userId = $payload['data']['user']['id'] ?? null;
        $token = $payload['data']['token'] ?? null;
        if (! is_numeric($userId)) {
            return;
        }

        UsageLog::query()->create([
            'user_id' => (int) $userId,
            'session_token' => is_string($token) ? mb_substr($token, 0, 100) : null,
            'event_type' => 'login',
            'project_id' => null,
            'layer_id' => null,
            'metadata' => [
                'endpoint' => '/'.$request->path(),
                'method' => $request->method(),
            ],
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }

    private function trackApiMutation(Request $request, Response $response): void
    {
        /** @var array<string, mixed>|null $payload */
        $payload = json_decode($response->getContent() ?: '', true);
        $target = $this->resolveTarget($request, is_array($payload) ? $payload : null);

        UsageLog::query()->create([
            'user_id' => $request->user()?->id,
            'session_token' => $request->bearerToken() ? mb_substr((string) $request->bearerToken(), 0, 100) : null,
            'event_type' => 'api_mutation',
            'project_id' => $this->routeParamInt($request, ['project']),
            'layer_id' => $this->routeParamInt($request, ['layer', 'layerId']),
            'metadata' => [
                'endpoint' => '/'.$request->path(),
                'method' => $request->method(),
                'target_type' => $target['type'],
                'target_id' => $target['id'],
            ],
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }

    /**
     * @param array<string, mixed>|null $payload
     * @return array{type: string|null, id: int|null}
     */
    private function resolveTarget(Request $request, ?array $payload): array
    {
        $map = [
            'zone' => ['zone', 'zoneId', 'id'],
            'mark' => ['mark', 'id'],
            'comment' => ['comment', 'id'],
            'layer' => ['layer', 'layerId'],
            'project' => ['project'],
            'master_layer' => ['masterLayer'],
            'notification' => ['id'],
            'activity_log' => ['id'],
        ];

        foreach ($map as $type => $keys) {
            $id = $this->routeParamInt($request, $keys);
            if ($id !== null) {
                return ['type' => $type, 'id' => $id];
            }
        }

        $createdId = $payload['data']['id'] ?? null;
        if (is_numeric($createdId)) {
            return ['type' => $this->inferTypeFromPath($request), 'id' => (int) $createdId];
        }

        return ['type' => $this->inferTypeFromPath($request), 'id' => null];
    }

    /**
     * @param array<int, string> $keys
     */
    private function routeParamInt(Request $request, array $keys): ?int
    {
        foreach ($keys as $key) {
            $value = $request->route($key);
            if (is_object($value) && isset($value->id) && is_numeric($value->id)) {
                return (int) $value->id;
            }
            if (is_numeric($value)) {
                return (int) $value;
            }
        }

        return null;
    }

    private function inferTypeFromPath(Request $request): ?string
    {
        $path = trim($request->path(), '/');

        return match (true) {
            str_ends_with($path, '/projects') => 'project',
            str_contains($path, '/master-layers') => 'master_layer',
            str_ends_with($path, '/layers') => 'layer',
            str_ends_with($path, '/zones') => 'zone',
            str_ends_with($path, '/marks') => 'mark',
            str_ends_with($path, '/comments') => 'comment',
            str_contains($path, '/activity-logs/') => 'activity_log',
            str_contains($path, '/notifications/') => 'notification',
            default => null,
        };
    }
}
