<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usage_logs', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('user_id')->nullable()->constrained('users');

            $table->string('session_token', 100)->nullable();
            $table->string('event_type', 50)->notNullable();

            $table->bigInteger('project_id')->nullable();
            $table->bigInteger('layer_id')->nullable();

            $table->jsonb('metadata')
                ->notNullable()
                ->default(DB::raw("'{}'::jsonb"));

            $table->string('ip_address', 45)->nullable();

            $table->timestampTz('created_at')->notNullable()->useCurrent();

            $table->index('user_id', 'idx_ul_user');
            $table->index('event_type', 'idx_ul_event');
            $table->index('created_at', 'idx_ul_created');
            $table->index('project_id', 'idx_ul_project');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_logs');
    }
};

