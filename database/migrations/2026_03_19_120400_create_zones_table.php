<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('layer_id')->constrained('layers')->cascadeOnDelete()->notNullable();

            $table->string('zone_code', 100)->notNullable()->unique();
            $table->string('name', 255)->notNullable();
            $table->string('name_full', 500)->nullable();

            $table->jsonb('geometry_pct')->notNullable();

            $table->string('status', 50)->notNullable()->default('not_started');
            $table->smallInteger('completion_pct')->notNullable()->default(0);

            $table->string('assignee', 255)->nullable();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();

            $table->date('deadline')->nullable();
            $table->text('tasks')->nullable();
            $table->text('notes')->nullable();

            $table->double('area_px')->nullable();
            $table->boolean('auto_detected')->notNullable()->default(false);

            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete()->notNullable();

            $table->timestampsTz();

            $table->index('layer_id', 'idx_zones_layer');
            $table->index('status', 'idx_zones_status');
            $table->index('zone_code', 'idx_zones_code');
        });

        DB::statement(
            "ALTER TABLE zones ADD CONSTRAINT zones_status_check CHECK (status IN ('not_started','in_progress','completed','delayed','paused'))"
        );
        DB::statement(
            "ALTER TABLE zones ADD CONSTRAINT zones_completion_pct_check CHECK (completion_pct >= 0 AND completion_pct <= 100)"
        );

        // PATCH: partial indexes used by sync/history queries
        DB::statement("CREATE INDEX idx_zones_deadline ON zones(deadline) WHERE deadline IS NOT NULL");
        DB::statement(
            "CREATE INDEX idx_zones_assigned ON zones(assigned_user_id) WHERE assigned_user_id IS NOT NULL"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('zones');
    }
};

