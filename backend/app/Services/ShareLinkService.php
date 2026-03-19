<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Layer;
use App\Models\Project;
use App\Models\ShareLink;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ShareLinkService
{
    private const ALLOWED_DAYS = [1, 7, 30];

    public function create(Project $project, User $actor, int $expiresInDays): ShareLink
    {
        if (! in_array($expiresInDays, self::ALLOWED_DAYS, true)) {
            throw ValidationException::withMessages([
                'expires_in_days' => ['Chỉ chấp nhận: 1, 7, 30 ngày.'],
            ]);
        }

        return ShareLink::query()->create([
            'project_id' => $project->id,
            'token' => Str::random(48),
            'created_by' => $actor->id,
            'expires_at' => now()->addDays($expiresInDays),
            'is_active' => true,
            'created_at' => now(),
        ]);
    }

    /**
     * @return Collection<int, ShareLink>
     */
    public function listActive(Project $project): Collection
    {
        return ShareLink::query()
            ->where('project_id', $project->id)
            ->where('is_active', true)
            ->orderByDesc('created_at')
            ->get();
    }

    public function revoke(ShareLink $shareLink): void
    {
        $shareLink->update(['is_active' => false]);
    }

    /**
     * Validate token và trả về project data (viewer-only).
     *
     * @return array{share_link: ShareLink, project: Project, layers: Collection}
     */
    public function resolveToken(string $token): array
    {
        $shareLink = ShareLink::query()
            ->with('project')
            ->where('token', $token)
            ->first();

        if ($shareLink === null || ! $shareLink->isValid()) {
            throw new \Symfony\Component\HttpKernel\Exception\GoneHttpException('Share link đã hết hạn hoặc đã bị thu hồi.');
        }

        $project = $shareLink->project;

        $layers = Layer::query()
            ->whereHas('masterLayer', fn ($q) => $q->where('project_id', $project->id))
            ->with(['masterLayer', 'zones.marks'])
            ->where('status', 'ready')
            ->get();

        return [
            'share_link' => $shareLink,
            'project' => $project,
            'layers' => $layers,
        ];
    }
}
