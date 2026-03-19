<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('layers', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('master_layer_id')->constrained()->cascadeOnDelete()->notNullable();

            $table->string('name', 255)->notNullable();
            $table->string('code', 50)->notNullable();

            $table->string('type', 50)->notNullable()->default('architecture');
            $table->string('status', 50)->notNullable()->default('uploading');

            $table->integer('sort_order')->notNullable()->default(0);

            $table->integer('next_zone_seq')->notNullable()->default(0);

            $table->string('original_filename', 500)->notNullable();
            $table->string('file_path', 500)->notNullable();
            $table->string('tile_path', 500)->nullable();
            $table->bigInteger('file_size')->notNullable();

            $table->integer('width_px')->nullable();
            $table->integer('height_px')->nullable();

            $table->integer('retry_count')->notNullable()->default(0);
            $table->text('error_message')->nullable();
            $table->timestampTz('processed_at')->nullable();

            $table->foreignId('uploaded_by')->constrained()->cascadeOnDelete()->notNullable();

            $table->timestampsTz();

            $table->unique(['master_layer_id', 'code']);
            $table->index(['master_layer_id'], 'idx_layers_ml');
            $table->index(['status'], 'idx_layers_status');
        });

        DB::statement(
            "ALTER TABLE layers ADD CONSTRAINT layers_type_check CHECK (type IN ('architecture','electrical','mechanical','plumbing','other'))"
        );
        DB::statement(
            "ALTER TABLE layers ADD CONSTRAINT layers_status_check CHECK (status IN ('uploading','processing','ready','failed'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('layers');
    }
};

