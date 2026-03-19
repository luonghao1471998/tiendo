<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            // Polymorphic — KHÔNG có FK constraint (intentional, PATCH-05)
            // Logs phải tồn tại sau khi entity bị xóa để rollback
            $table->string('target_type', 50);
            $table->unsignedBigInteger('target_id'); // NO ->constrained()
            // Action
            $table->string('action', 50);
            // Full entity state TRƯỚC khi sửa
            $table->jsonb('snapshot_before')->nullable();
            // Chỉ fields thay đổi
            $table->jsonb('changes')->nullable();
            // Nếu action=restored
            $table->foreignId('restored_from_log_id')->nullable()->constrained('activity_logs')->nullOnDelete();
            // Who + When (denormalize user_name để query nhanh)
            $table->foreignId('user_id')->constrained('users');
            $table->string('user_name', 255);
            $table->timestampTz('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
