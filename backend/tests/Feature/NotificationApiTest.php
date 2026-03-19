<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_list_notifications_unread_first_and_paginated(): void
    {
        $user = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'deadline_approaching',
            'title' => 'Old read',
            'body' => null,
            'data' => ['zone_id' => 1],
            'read_at' => now()->subDay(),
            'created_at' => now()->subHour(),
        ]);
        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'deadline_approaching',
            'title' => 'Unread newest',
            'body' => null,
            'data' => ['zone_id' => 2],
            'read_at' => null,
            'created_at' => now(),
        ]);
        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'deadline_approaching',
            'title' => 'Unread older',
            'body' => null,
            'data' => ['zone_id' => 3],
            'read_at' => null,
            'created_at' => now()->subMinutes(5),
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/notifications?per_page=2');
        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('data.0.title', 'Unread newest')
            ->assertJsonPath('data.1.title', 'Unread older');
    }

    public function test_unread_count_returns_only_unread_items(): void
    {
        $user = User::factory()->create([
            'role' => 'field_team',
            'is_active' => true,
        ]);

        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'deadline_approaching',
            'title' => 'N1',
            'data' => [],
            'read_at' => null,
            'created_at' => now(),
        ]);
        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'deadline_approaching',
            'title' => 'N2',
            'data' => [],
            'read_at' => now(),
            'created_at' => now(),
        ]);

        Sanctum::actingAs($user);
        $this->getJson('/api/v1/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.count', 1);
    }

    public function test_mark_read_updates_single_notification_for_current_user_only(): void
    {
        $user = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);
        $other = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);

        $own = Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'deadline_approaching',
            'title' => 'Own unread',
            'data' => [],
            'read_at' => null,
            'created_at' => now(),
        ]);
        $otherNotification = Notification::query()->create([
            'user_id' => $other->id,
            'type' => 'deadline_approaching',
            'title' => 'Other unread',
            'data' => [],
            'read_at' => null,
            'created_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $this->patchJson('/api/v1/notifications/'.$own->id.'/read')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $own->id);

        $this->assertDatabaseMissing('notifications', [
            'id' => $own->id,
            'read_at' => null,
        ]);

        $this->patchJson('/api/v1/notifications/'.$otherNotification->id.'/read')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_mark_all_read_marks_only_current_user_unread(): void
    {
        $user = User::factory()->create([
            'role' => 'project_manager',
            'is_active' => true,
        ]);
        $other = User::factory()->create([
            'role' => 'viewer',
            'is_active' => true,
        ]);

        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'deadline_approaching',
            'title' => 'U1',
            'data' => [],
            'read_at' => null,
            'created_at' => now(),
        ]);
        Notification::query()->create([
            'user_id' => $user->id,
            'type' => 'deadline_approaching',
            'title' => 'U2',
            'data' => [],
            'read_at' => null,
            'created_at' => now(),
        ]);
        Notification::query()->create([
            'user_id' => $other->id,
            'type' => 'deadline_approaching',
            'title' => 'Other',
            'data' => [],
            'read_at' => null,
            'created_at' => now(),
        ]);

        Sanctum::actingAs($user);
        $this->patchJson('/api/v1/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.affected', 2);

        $this->assertSame(0, Notification::query()->where('user_id', $user->id)->whereNull('read_at')->count());
        $this->assertSame(1, Notification::query()->where('user_id', $other->id)->whereNull('read_at')->count());
    }
}
