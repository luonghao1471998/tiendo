<?php

namespace App\Providers;

use App\Models\MasterLayer;
use App\Models\Project;
use App\Models\User;
use App\Policies\LayerPolicy;
use App\Policies\MasterLayerPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Gate::define('viewMasterLayers', function (User $user, Project $project) {
            return app(MasterLayerPolicy::class)->viewList($user, $project);
        });

        Gate::define('manageMasterLayers', function (User $user, Project $project) {
            return app(MasterLayerPolicy::class)->manage($user, $project);
        });

        Gate::define('uploadLayer', function (User $user, MasterLayer $masterLayer) {
            return app(LayerPolicy::class)->upload($user, $masterLayer);
        });
    }
}
