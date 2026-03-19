<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Services\NotificationService;
use Illuminate\Console\Command;

class CheckDeadlinesCommand extends Command
{
    protected $signature = 'tiendo:check-deadlines';

    protected $description = 'Create deadline notifications with dedupe';

    public function __construct(private readonly NotificationService $notificationService)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $result = $this->notificationService->checkDeadlines();

        $this->info(sprintf(
            'Processed zones: %d. Created notifications: %d.',
            $result['processed_zones'],
            $result['created_notifications']
        ));

        return self::SUCCESS;
    }
}
