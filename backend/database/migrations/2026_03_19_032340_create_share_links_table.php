<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // PATCH-04: MVP share link = viewer only, KHÔNG có role column
        Schema::create('share_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('token', 64)->unique();
            // KHÔNG có role column — MVP luôn viewer
            $table->foreignId('created_by')->constrained('users');
            $table->timestampTz('expires_at');
            $table->boolean('is_active')->default(true);
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('share_links');
    }
};
