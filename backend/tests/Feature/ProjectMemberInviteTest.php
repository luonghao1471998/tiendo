<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProjectMemberInviteTest extends TestCase
{
    use RefreshDatabase;

    // ---------------------------------------------------------------
    // list members
    // ---------------------------------------------------------------

    public function test_pm_can_list_members(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $response = $this->getJson('/api/v1/projects/'.$project->id.'/members');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data');

        $this->assertEquals($pm->id, $response->json('data.0.user_id'));
    }

    // ---------------------------------------------------------------
    // invite new user (create account)
    // ---------------------------------------------------------------

    public function test_pm_can_invite_new_user_and_gets_temporary_password(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $response = $this->postJson('/api/v1/projects/'.$project->id.'/members/invite', [
            'email' => 'newbie@example.com',
            'name' => 'Tân thành viên',
            'role' => 'field_team',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.member.role', 'field_team');

        // temporary_password xuất hiện đúng 1 lần
        $this->assertArrayHasKey('temporary_password', $response->json('data'));
        $pwd = $response->json('data.temporary_password');
        $this->assertNotNull($pwd);
        $this->assertGreaterThanOrEqual(8, strlen($pwd));

        // User được tạo trong DB
        $this->assertDatabaseHas('users', ['email' => 'newbie@example.com', 'role' => 'viewer']);
        // Password hash khớp
        $user = User::query()->where('email', 'newbie@example.com')->first();
        $this->assertTrue(Hash::check($pwd, $user->password));
    }

    // ---------------------------------------------------------------
    // invite existing user (no new account)
    // ---------------------------------------------------------------

    public function test_pm_can_invite_existing_user_without_temporary_password(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        $existing = User::factory()->create([
            'role' => 'viewer',
            'is_active' => true,
        ]);

        Sanctum::actingAs($pm);
        $response = $this->postJson('/api/v1/projects/'.$project->id.'/members/invite', [
            'email' => $existing->email,
            'role' => 'viewer',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.member.user_id', $existing->id);

        // Không trả temporary_password
        $this->assertArrayNotHasKey('temporary_password', $response->json('data'));
    }

    // ---------------------------------------------------------------
    // PM không được tạo project_manager
    // ---------------------------------------------------------------

    public function test_pm_cannot_invite_as_project_manager(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $response = $this->postJson('/api/v1/projects/'.$project->id.'/members/invite', [
            'email' => 'another@example.com',
            'role' => 'project_manager',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    // ---------------------------------------------------------------
    // Admin được tạo project_manager
    // ---------------------------------------------------------------

    public function test_admin_can_invite_as_project_manager(): void
    {
        [, $project] = $this->createProjectWithPm();

        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        Sanctum::actingAs($admin);
        $response = $this->postJson('/api/v1/projects/'.$project->id.'/members/invite', [
            'email' => 'pm2@example.com',
            'name' => 'PM khác',
            'role' => 'project_manager',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.member.role', 'project_manager');
    }

    // ---------------------------------------------------------------
    // Duplicate member → 422
    // ---------------------------------------------------------------

    public function test_cannot_invite_already_existing_member(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $this->postJson('/api/v1/projects/'.$project->id.'/members/invite', [
            'email' => 'dup@example.com',
            'role' => 'field_team',
        ])->assertStatus(201);

        // Invite lần 2 cùng email
        $response = $this->postJson('/api/v1/projects/'.$project->id.'/members/invite', [
            'email' => 'dup@example.com',
            'role' => 'viewer',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    // ---------------------------------------------------------------
    // Outsider bị 403
    // ---------------------------------------------------------------

    public function test_outsider_cannot_invite_members(): void
    {
        [, $project] = $this->createProjectWithPm();

        $outsider = User::factory()->create(['role' => 'field_team', 'is_active' => true]);

        Sanctum::actingAs($outsider);
        $this->postJson('/api/v1/projects/'.$project->id.'/members/invite', [
            'email' => 'x@example.com',
            'role' => 'field_team',
        ])->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // Remove member
    // ---------------------------------------------------------------

    public function test_pm_can_remove_member(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        $member = User::factory()->create(['role' => 'viewer', 'is_active' => true]);
        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $member->id,
            'role' => 'field_team',
            'created_at' => now(),
        ]);

        Sanctum::actingAs($pm);
        $this->deleteJson('/api/v1/projects/'.$project->id.'/members/'.$member->id)
            ->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseMissing('project_members', [
            'project_id' => $project->id,
            'user_id' => $member->id,
        ]);
    }

    public function test_cannot_remove_project_creator(): void
    {
        [$pm, $project] = $this->createProjectWithPm();

        Sanctum::actingAs($pm);
        $this->deleteJson('/api/v1/projects/'.$project->id.'/members/'.$pm->id)
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');
    }

    // ---------------------------------------------------------------
    // helpers
    // ---------------------------------------------------------------

    /**
     * @return array{0: User, 1: Project}
     */
    private function createProjectWithPm(): array
    {
        $pm = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $project = Project::query()->create([
            'name' => 'Test Project',
            'code' => 'TPRJ'.rand(1000, 9999),
            'created_by' => $pm->id,
        ]);

        ProjectMember::query()->create([
            'project_id' => $project->id,
            'user_id' => $pm->id,
            'role' => 'project_manager',
            'created_at' => now(),
        ]);

        return [$pm, $project];
    }
}
