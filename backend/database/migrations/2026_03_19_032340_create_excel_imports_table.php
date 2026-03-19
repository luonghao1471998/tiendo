<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('excel_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('layer_id')->constrained('layers');
            $table->string('filename', 255);
            $table->string('file_path', 500)->nullable();
            $table->string('status', 50)->default('pending');
            // pending | preview_ready | applied | failed
            $table->jsonb('column_mapping')->nullable();
            $table->jsonb('preview_data')->nullable();
            $table->jsonb('result_data')->nullable();
            $table->foreignId('imported_by')->constrained('users');
            $table->timestampTz('created_at')->useCurrent();
            $table->timestampTz('applied_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('excel_imports');
    }
};
