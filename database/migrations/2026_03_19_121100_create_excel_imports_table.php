<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('excel_imports', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('layer_id')->constrained('layers')->notNullable();

            $table->string('filename', 255)->notNullable();
            $table->string('file_path', 500)->nullable();

            $table->string('status', 50)->notNullable()->default('pending');

            $table->jsonb('column_mapping')->nullable();
            $table->jsonb('preview_data')->nullable();
            $table->jsonb('result_data')->nullable();

            $table->foreignId('imported_by')->constrained('users')->cascadeOnDelete()->notNullable();

            $table->timestampTz('created_at')->notNullable()->useCurrent();
            $table->timestampTz('applied_at')->nullable();

            $table->index('layer_id', 'idx_ei_layer');
        });

        DB::statement(
            "ALTER TABLE excel_imports ADD CONSTRAINT excel_imports_status_check CHECK (status IN ('pending','preview_ready','applied','failed'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('excel_imports');
    }
};

