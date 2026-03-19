<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('layer_id')->constrained()->cascadeOnDelete();
            $table->string('zone_code', 100)->unique();
            $table->string('name', 255);
            $table->string('name_full', 500)->nullable();
            // Geometry: tọa độ % (0.0–1.0)
            $table->jsonb('geometry_pct');
            // Status
            $table->string('status', 50)->default('not_started');
            $table->smallInteger('completion_pct')->default(0);
            // Assignment
            $table->string('assignee', 255)->nullable();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('deadline')->nullable();
            $table->text('tasks')->nullable();
            $table->text('notes')->nullable();
            // Computed
            $table->double('area_px')->nullable();
            $table->boolean('auto_detected')->default(false);
            // Audit
            $table->foreignId('created_by')->constrained('users');
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zones');
    }
};
