<?php

declare(strict_types=1);

namespace App\Repositories;

use App\Models\UsageLog;

class UsageLogRepository
{
    /**
     * @param array<string, mixed> $data
     */
    public function create(array $data): UsageLog
    {
        return UsageLog::query()->create($data);
    }
}
