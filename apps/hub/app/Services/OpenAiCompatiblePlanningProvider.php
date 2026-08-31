<?php

namespace App\Services;

use App\Contracts\ProjectPlanningProvider;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenAiCompatiblePlanningProvider implements ProjectPlanningProvider
{
    public const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434/v1';
    public const DEFAULT_VLLM_ENDPOINT = 'http://127.0.0.1:8000/v1';
    public const DEFAULT_OLLAMA_MODEL = 'qwen2.5-coder:32b';
    public const DEFAULT_VLLM_MODEL = 'deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct';

    public function __construct(
        private readonly string $baseUrl = self::DEFAULT_OLLAMA_ENDPOINT,
        private readonly string $model = self::DEFAULT_OLLAMA_MODEL,
        private readonly ?string $apiKey = null,
        private readonly float $temperature = 0.2,
    ) {
    }

    public static function forOllama(
        string $model = self::DEFAULT_OLLAMA_MODEL,
        ?string $baseUrl = null,
        ?string $apiKey = null,
        float $temperature = 0.2,
    ): self {
        return new self(
            baseUrl: $baseUrl ?: self::DEFAULT_OLLAMA_ENDPOINT,
            model: $model,
            apiKey: $apiKey,
            temperature: $temperature,
        );
    }

    public static function forVllm(
        string $model = self::DEFAULT_VLLM_MODEL,
        ?string $baseUrl = null,
        ?string $apiKey = null,
        float $temperature = 0.2,
    ): self {
        return new self(
            baseUrl: $baseUrl ?: self::DEFAULT_VLLM_ENDPOINT,
            model: $model,
            apiKey: $apiKey,
            temperature: $temperature,
        );
    }

    public function resolveEndpoint(): string
    {
        $url = trim($this->baseUrl);
        if ($url === '' || strtolower($url) === 'ollama') {
            return rtrim(self::DEFAULT_OLLAMA_ENDPOINT, '/') . '/chat/completions';
        }
        if (strtolower($url) === 'vllm') {
            return rtrim(self::DEFAULT_VLLM_ENDPOINT, '/') . '/chat/completions';
        }
        if (str_ends_with($url, '/chat/completions')) {
            return $url;
        }
        if (str_ends_with($url, '/v1')) {
            return $url . '/chat/completions';
        }

        $parsed = parse_url($url);
        if (empty($parsed['path']) || $parsed['path'] === '/') {
            return rtrim($url, '/') . '/v1/chat/completions';
        }

        return rtrim($url, '/') . '/chat/completions';
    }

    public function resolveModel(): string
    {
        $trimmed = trim($this->model);
        if ($trimmed !== '' && $trimmed !== 'default') {
            return $trimmed;
        }

        if ($this->isOllama()) {
            return self::DEFAULT_OLLAMA_MODEL;
        }
        if ($this->isVllm()) {
            return self::DEFAULT_VLLM_MODEL;
        }

        return 'gpt-4o-mini';
    }

    public function isLocal(): bool
    {
        return $this->isOllama() || $this->isVllm() || $this->isLoopbackAddress();
    }

    public function isOllama(): bool
    {
        $url = strtolower($this->baseUrl);
        return str_contains($url, 'ollama') || str_contains($url, ':11434');
    }

    public function isVllm(): bool
    {
        $url = strtolower($this->baseUrl);
        return str_contains($url, 'vllm') || str_contains($url, ':8000');
    }

    private function isLoopbackAddress(): bool
    {
        $url = strtolower($this->baseUrl);
        return str_contains($url, '127.0.0.1') || str_contains($url, 'localhost') || str_contains($url, '0.0.0.0');
    }

    public function generatePlan(string $prompt, array $options = []): array
    {
        $endpoint = $this->resolveEndpoint();
        $model = $this->resolveModel();

        $client = Http::acceptJson()
            ->timeout(60)
            ->retry(1, 250);

        if (!empty($this->apiKey) && $this->apiKey !== 'none' && $this->apiKey !== 'EMPTY') {
            $client = $client->withToken($this->apiKey);
        }

        $requestData = [
            'model' => $model,
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
        ];

        $response = $client->post($endpoint, $requestData);

        // If local model server doesn't support response_format json_object (HTTP 400), retry without it
        if ($response->status() === 400 && isset($requestData['response_format'])) {
            unset($requestData['response_format']);
            $response = $client->post($endpoint, $requestData);
        }

        if ($response->failed()) {
            throw new RuntimeException('The planning provider returned an error: ' . $response->status());
        }

        $content = data_get($response->json(), 'choices.0.message.content');
        if (!is_string($content) || trim($content) === '') {
            throw new RuntimeException('The planning provider returned an empty plan.');
        }

        $decoded = $this->extractJson($content);
        if (!is_array($decoded)) {
            throw new RuntimeException('The planning provider returned invalid JSON.');
        }

        return $decoded;
    }

    public function extractJson(string $content): ?array
    {
        // 1. Remove reasoning / thinking tokens (e.g. <think>...</think>)
        $cleaned = preg_replace('/<think>[\s\S]*?<\/think>/i', '', $content);
        $cleaned = $this->stripCodeFence($cleaned ?? $content);

        $decoded = json_decode($cleaned, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        // 2. Try regex extraction of first outer JSON object
        if (preg_match('/\{[\s\S]*\}/', $cleaned, $matches)) {
            $extracted = json_decode($matches[0], true);
            if (is_array($extracted)) {
                return $extracted;
            }
        }

        return null;
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
project, summary, epics, sprints.
The project object must include title, key, type, color, description.
The summary object must include epic_count, sprint_count, total_tasks, total_story_points, total_pomodoros, estimated_weeks, start_date, end_date.
The epics array defines high-level milestones / product modules at the roadmap level (issue_type: "epic", title, description, priority, story_points).
The sprints array defines time-boxed iterations. Each sprint must include name, goal, start_date, end_date, status, tasks.
Tasks inside sprints MUST be actionable items (issue_type: "story", "task", or "bug") and MUST NOT be epics. Each task must include issue_type, title, description, priority, category, story_points, status, estimated_pomodoros, epic_ref (referencing an epic title), start_date, due_date, subtasks.
Use at most {$sprintCount} sprints of {$sprintWeeks} weeks each, starting {$startDate}.
Preferred project title: {$title}
Preferred project key: {$key}
Use only statuses todo, in_progress; priorities urgent, high, medium, low; issue types story, task, bug for sprint tasks, epic for epics.
Keep the plan suitable for one indie developer. Do not include markdown fences.
PROMPT;
    }

    public function stripCodeFence(string $content): string
    {
        return trim((string) preg_replace('/^```(?:json)?\s*|\s*```$/i', '', trim($content)));
    }
}
