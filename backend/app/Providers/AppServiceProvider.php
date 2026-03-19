<?php
namespace App\Providers;

use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void {}

    public function boot(): void
    {
        Gate::policy(\App\Models\Project::class, \App\Policies\ProjectPolicy::class);
        Gate::policy(\App\Models\User::class, \App\Policies\UserPolicy::class);
        Gate::policy(\App\Models\MasterLayer::class, \App\Policies\MasterLayerPolicy::class);
        Gate::policy(\App\Models\Layer::class, \App\Policies\LayerPolicy::class);
        Gate::policy(\App\Models\Zone::class, \App\Policies\ZonePolicy::class);
        Gate::policy(\App\Models\Mark::class, \App\Policies\MarkPolicy::class);
        Gate::policy(\App\Models\ZoneComment::class, \App\Policies\ZoneCommentPolicy::class);
        Gate::policy(\App\Models\ActivityLog::class, \App\Policies\ActivityLogPolicy::class);

        // Layer upload dùng MasterLayer làm argument
        Gate::define('upload', function ($user, $model) {
            if ($model instanceof \App\Models\MasterLayer) {
                return app(\App\Policies\LayerPolicy::class)->upload($user, $model);
            }
            return false;
        });
    }
}
