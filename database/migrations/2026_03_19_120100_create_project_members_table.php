<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_members', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete()->notNullable();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete()->notNullable();

            $table->string('role', 50)->notNullable()->default('viewer');
            $table->timestampTz('created_at')->notNullable()->useCurrent();

            $table->unique(['project_id', 'user_id']);
            $table->index('project_id', 'idx_pm_project');
            $table->index('user_id', 'idx_pm_user');
        });

        DB::statement(
            "ALTER TABLE project_members ADD CONSTRAINT project_members_role_check CHECK (role IN ('project_manager','field_team','viewer'))"
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('project_members');
    }
};

