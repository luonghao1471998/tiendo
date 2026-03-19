<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->string('target_type', 50)->notNullable();
            // PATCH-05: activity_logs.target_id KHONG co FK constraint intentionally
            $table->unsignedBigInteger('target_id')->notNullable();

            $table->string('action', 50)->notNullable();

            $table->jsonb('snapshot_before')->nullable();
            $table->jsonb('changes')->nullable();

            $table->foreignId('restored_from_log_id')->nullable()->constrained('activity_logs')->nullOnDelete();

            $table->foreignId('user_id')->constrained()->notNullable();
            $table->string('user_name', 255)->notNullable();

            $table->timestampTz('created_at')->notNullable()->useCurrent();

            $table->index(['target_type', 'target_id'], 'idx_al_target');
            $table->index(['user_id'], 'idx_al_user');
            $table->index(['created_at'], 'idx_al_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};

