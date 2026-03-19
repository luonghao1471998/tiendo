<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('user_id')->constrained()->cascadeOnDelete()->notNullable();

            $table->string('type', 100)->notNullable();
            $table->string('title', 500)->notNullable();
            $table->text('body')->nullable();

            $table->jsonb('data')->notNullable()->default(DB::raw("'{}'::jsonb"));

            $table->timestampTz('read_at')->nullable();
            $table->timestampTz('created_at')->notNullable()->useCurrent();

            $table->index(['user_id'], 'idx_notif_user');
        });

        DB::statement(
            "CREATE INDEX idx_notif_unread ON notifications(user_id, read_at) WHERE read_at IS NULL"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};

