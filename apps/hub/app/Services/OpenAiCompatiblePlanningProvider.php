<?php

namespace App\Services;

use App\Contracts\ProjectPlanningProvider;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenAiCompatiblePlanningProvider implements ProjectPlanningProvider
{
    public function __construct(
        private readonly string $baseUrl,
        private readonly string $model,
        private readonly string $apiKey,
        private readonly float $temperature = 0.2,
    ) {
    }

    public function generatePlan(string $prompt, array $options = []): array
    {
        $endpoint = rtrim($this->baseUrl, '/') . '/chat/completions';
        $response = Http::withToken($this->apiKey)
            ->acceptJson()
            ->timeout(45)
            ->retry(1, 250)
            ->post($endpoint, [
                'model' => $this->model,
                'temperature' => $this->temperature,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are a pragmatic software project planner. Return only valid JSON matching the requested schema. Keep scope realistic and never invent credentials or private data.',
                    ],
                    [
                        'role' => 'user',
                        'content' => $this->buildPrompt($prompt, $options),
                    ],
                ],
            ]);

        if ($response->failed()) {
            throw new RuntimeException('The planning provider returned an error.');
        }

        $content = data_get($response->json(), 'choices.0.message.content');
        if (!is_string($content) || trim($content) === '') {
            throw new RuntimeException('The planning provider returned an empty plan.');
        }

        $decoded = json_decode($this->stripCodeFence($content), true);
        if (!is_array($decoded)) {
            throw new RuntimeException('The planning provider returned invalid JSON.');
        }

        return $decoded;
    }

    private function buildPrompt(string $prompt, array $options): string
    {
        $sprintCount = (int) ($options['sprint_count'] ?? 3);
        $sprintWeeks = (int) ($options['sprint_duration_weeks'] ?? 2);
        $startDate = $options['start_date'] ?? now()->toDateString();
        $title = $options['project_title'] ?? '';
        $key = $options['project_key'] ?? '';

        return <<<PROMPT
Create a practical project plan from this idea:
{$prompt}

Return JSON with exactly these top-level keys:
project, summary, sprints.
The project object must include title, key, type, color, description.
The summary object must include sprint_count, total_tasks, total_story_points, total_pomodoros, estimated_weeks, start_date, end_date.
Each sprint must include name, goal, start_date, end_date, status, tasks.
Each task must include issue_type, title, description, priority, category, story_points, status, estimated_pomodoros, start_date, due_date, subtasks.
Use at most {$sprintCount} sprints of {$sprintWeeks} weeks each, starting {$startDate}.
Preferred project title: {$title}
Preferred project key: {$key}
Use only statuses todo, in_progress; priorities urgent, high, medium, low; issue types epic, story, task, bug.
Keep the plan suitable for one indie developer. Do not include markdown fences.
PROMPT;
    }

    private function stripCodeFence(string $content): string
    {
        return trim((string) preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($content)));
    }
}
