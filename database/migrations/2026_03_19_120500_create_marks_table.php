<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marks', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('zone_id')->constrained('zones')->cascadeOnDelete()->notNullable();
            $table->jsonb('geometry_pct')->notNullable();

            $table->string('status', 50)->notNullable()->default('in_progress');
            $table->text('note')->nullable();

            $table->foreignId('painted_by')->constrained('users')->cascadeOnDelete()->notNullable();

            $table->timestampsTz();

            $table->index('zone_id', 'idx_marks_zone');
        });

        DB::statement(
            "ALTER TABLE marks ADD CONSTRAINT marks_status_check CHECK (status IN ('in_progress','completed'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('marks');
    }
};

