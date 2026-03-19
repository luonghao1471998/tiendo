<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HealthEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_is_public_and_returns_ok(): void
    {
        $response = $this->getJson('/api/v1/health');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'ok');
    }
}
