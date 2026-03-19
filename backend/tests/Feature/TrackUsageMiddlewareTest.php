<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\UsageLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TrackUsageMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    public function test_successful_login_creates_login_usage_log_only(): void
    {
        $user = User::factory()->create([
            'email' => 'pm@example.com',
            'password' => 'secret123',
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'pm@example.com',
            'password' => 'secret123',
        ])->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('usage_logs', [
            'user_id' => $user->id,
            'event_type' => 'login',
        ]);

        $this->assertSame(0, UsageLog::query()->where('event_type', 'api_mutation')->count());
    }

    public function test_failed_login_does_not_create_usage_log(): void
    {
        User::factory()->create([
            'email' => 'pm@example.com',
            'password' => 'secret123',
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'pm@example.com',
            'password' => 'wrong-password',
        ])->assertStatus(422);

        $this->assertSame(0, UsageLog::query()->count());
    }

    public function test_successful_mutation_creates_api_mutation_usage_log_with_target_metadata(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/v1/projects', [
            'name' => 'Project A',
            'code' => 'PRJ',
            'description' => 'Demo',
            'address' => 'HN',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $projectId = (int) $response->json('data.id');

        $log = UsageLog::query()->where('event_type', 'api_mutation')->latest('id')->first();
        $this->assertNotNull($log);
        $this->assertSame($admin->id, $log->user_id);
        $this->assertSame('/api/v1/projects', $log->metadata['endpoint'] ?? null);
        $this->assertSame('POST', $log->metadata['method'] ?? null);
        $this->assertSame('project', $log->metadata['target_type'] ?? null);
        $this->assertSame($projectId, $log->metadata['target_id'] ?? null);
    }

    public function test_validation_failure_does_not_create_api_mutation_usage_log(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
        ]);

        Sanctum::actingAs($admin);

        $this->postJson('/api/v1/projects', [
            'name' => '',
            'code' => '',
        ])->assertStatus(422);

        $this->assertSame(0, UsageLog::query()->where('event_type', 'api_mutation')->count());
    }

    public function test_analytics_endpoint_does_not_create_duplicate_api_mutation_log(): void
    {
        $user = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/analytics/events', [
            'event_type' => 'page_view',
            'metadata' => [
                'page' => '/projects',
                'referrer' => '/login',
            ],
        ])->assertStatus(201);

        $this->assertSame(1, UsageLog::query()->count());
        $this->assertSame(0, UsageLog::query()->where('event_type', 'api_mutation')->count());
        $this->assertSame(1, UsageLog::query()->where('event_type', 'page_view')->count());
    }
}
