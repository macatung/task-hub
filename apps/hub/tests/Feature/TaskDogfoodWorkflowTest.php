<?php

namespace Tests\Feature;

use App\Models\Task;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TaskDogfoodWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_daily_dispatch_returns_at_most_three_focus_tasks(): void
    {
        $project = \App\Models\Project::create(['title' => 'Dogfood Project', 'slug' => 'dogfood-project', 'tagline' => 'Dogfood Tagline', 'description' => 'Desc', 'key' => 'DFP']);
        foreach (range(1, 5) as $index) {
            Task::create(['title' => "Focus task {$index}", 'status' => 'todo', 'priority' => 'high', 'due_date' => now()->toDateString(), 'project_id' => $project->id]);
        }

        $response = $this->getJson('/api/tasks/daily-dispatch');

        $response->assertOk()->assertJsonPath('focus_limit', 3);
        $this->assertCount(3, $response->json('active_tasks'));
    }

    public function test_next_action_prioritizes_in_progress_task(): void
    {
        $project = \App\Models\Project::create(['title' => 'Dogfood Project', 'slug' => 'dogfood-project-2', 'tagline' => 'Dogfood Tagline 2', 'description' => 'Desc 2', 'key' => 'DFP2']);
        $low = Task::create(['title' => 'Urgent backlog', 'status' => 'todo', 'priority' => 'urgent', 'project_id' => $project->id]);
        $active = Task::create(['title' => 'Current work', 'status' => 'in_progress', 'priority' => 'medium', 'project_id' => $project->id]);

        $response = $this->getJson('/api/tasks/next-action');

        $response->assertOk()->assertJsonPath('data.id', $active->id);
        $this->assertNotEquals($low->id, $response->json('data.id'));
    }

    public function test_ai_settings_never_returns_the_api_key(): void
    {
        $this->postJson('/api/tasks/ai-settings', [
            'provider' => 'openai_compatible',
            'base_url' => 'https://api.openai.com/v1',
            'model' => 'gpt-4o-mini',
            'temperature' => 0.2,
            'api_key' => 'secret-test-key',
        ])->assertOk();

        $response = $this->getJson('/api/tasks/ai-settings')->assertOk();

        $response->assertJsonPath('data.has_api_key', true);
        $this->assertArrayNotHasKey('api_key', $response->json('data'));
        $this->assertDatabaseMissing('site_settings', ['value' => 'secret-test-key']);
    }

    public function test_ai_plan_preview_records_usage_without_persisting_tasks(): void
    {
        $initialProjects = \App\Models\Project::count();
        $response = $this->postJson('/api/tasks/ai-preview', [
            'prompt' => 'Build a small private developer journal',
            'sprint_count' => 1,
        ])->assertOk();

        $response->assertJsonPath('success', true);
        $this->assertEquals($initialProjects, \App\Models\Project::count());
        $this->assertDatabaseCount('tasks', 0);
        $this->assertDatabaseHas('task_usage_events', ['event_type' => 'ai_plan_previewed']);
    }
}
