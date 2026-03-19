<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('session_token', 100)->nullable();
            $table->string('event_type', 50);
            // login, page_view, canvas_view, zone_click,
            // mark_created, status_changed, comment_created,
            // export_excel, share_link_accessed
            $table->unsignedBigInteger('project_id')->nullable();
            $table->unsignedBigInteger('layer_id')->nullable();
            $table->jsonb('metadata')->default('{}');
            $table->string('ip_address', 45)->nullable();
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_logs');
    }
};
