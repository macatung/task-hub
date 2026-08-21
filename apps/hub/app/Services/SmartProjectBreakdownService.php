<?php

namespace App\Services;

use App\Contracts\ProjectPlanningProvider;
use App\Models\Project;
use App\Models\Sprint;
use App\Models\Task;
use Carbon\Carbon;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class SmartProjectBreakdownService implements ProjectPlanningProvider
{
    /**
     * Generate a structured plan (Sprints, Epics, Tasks, Subtasks) from a project requirement prompt.
     */
    public function generatePlan(string $prompt, array $options = []): array
    {
        $prompt = trim($prompt);
        $sprintCount = isset($options['sprint_count']) && (int)$options['sprint_count'] > 0 ? (int)$options['sprint_count'] : 3;
        $sprintWeeks = isset($options['sprint_duration_weeks']) && (int)$options['sprint_duration_weeks'] > 0 ? (int)$options['sprint_duration_weeks'] : 2;
        $startDate = !empty($options['start_date']) ? Carbon::parse($options['start_date']) : Carbon::today();
        $projectTitle = !empty($options['project_title']) ? trim($options['project_title']) : $this->inferProjectTitle($prompt);
        $projectKey = !empty($options['project_key']) ? strtoupper(trim($options['project_key'])) : $this->inferProjectKey($projectTitle);
        $projectColor = $options['project_color'] ?? '#2563eb';

        // Check for domain keywords in the prompt
        $domains = $this->analyzeDomains($prompt);

        // Generate Sprints & Tasks
        $generatedSprints = $this->buildSprintsAndTasks($prompt, $projectTitle, $projectKey, $sprintCount, $sprintWeeks, $startDate, $domains);

        $totalPoints = 0;
        $totalTasks = 0;
        $totalPomodoros = 0;

        foreach ($generatedSprints as $sprint) {
            foreach ($sprint['tasks'] as $task) {
                $totalTasks++;
                $totalPoints += (int)($task['story_points'] ?? 0);
                $totalPomodoros += (int)($task['estimated_pomodoros'] ?? 0);
            }
        }

        return [
            'success' => true,
            'project' => [
                'title' => $projectTitle,
                'key' => $projectKey,
                'color' => $projectColor,
                'description' => Str::limit($prompt, 180),
            ],
            'summary' => [
                'sprint_count' => count($generatedSprints),
                'total_tasks' => $totalTasks,
                'total_story_points' => $totalPoints,
                'total_pomodoros' => $totalPomodoros,
                'estimated_weeks' => count($generatedSprints) * $sprintWeeks,
                'start_date' => $startDate->toDateString(),
                'end_date' => $startDate->copy()->addWeeks(count($generatedSprints) * $sprintWeeks)->toDateString(),
            ],
            'sprints' => $generatedSprints,
        ];
    }

    /** Use the configured provider while retaining the deterministic planner as fallback. */
    public function generatePlanWithProvider(string $prompt, array $options = []): array
    {
        $settings = $this->planningSettings();

        if (($settings['provider'] ?? 'template') === 'openai_compatible' && !empty($settings['api_key'])) {
            try {
                return $this->normalizePlan((new OpenAiCompatiblePlanningProvider(
                    $settings['base_url'],
                    $settings['model'],
                    $settings['api_key'],
                    (float) $settings['temperature'],
                ))->generatePlan($prompt, $options), $options);
            } catch (\Throwable $exception) {
                report($exception);
            }
        }

        return $this->normalizePlan($this->generatePlan($prompt, $options), $options);
    }

    /**
     * Commit the generated plan into the database (Project, Sprints, Epics, Tasks, Subtasks).
     */
    public function executePlan(array $planData, array $options = []): array
    {
        $normalized = $this->normalizePlan($planData, $options);

        return DB::transaction(fn () => $this->executePlanUnsafe($normalized, $options));
    }

    private function executePlanUnsafe(array $planData, array $options = []): array
    {
        $projectInfo = $planData['project'] ?? [];
        $sprintsData = $planData['sprints'] ?? [];

        // 1. Create or select Project
        $projectId = $options['project_id'] ?? null;
        $project = null;

        if ($projectId && $projectId !== 'new' && $projectId !== 'all') {
            $project = Project::find($projectId);
        }

        if (!$project && !empty($projectInfo['title'])) {
            $slug = Str::slug($projectInfo['title']);
            $existing = Project::where('slug', $slug)->first();
            if ($existing) {
                $slug .= '-' . rand(100, 999);
            }

            $tagline = !empty($projectInfo['tagline'])
                ? $projectInfo['tagline']
                : (!empty($projectInfo['description']) ? Str::limit($projectInfo['description'], 100) : $projectInfo['title']);

            $project = Project::create([
                'title' => $projectInfo['title'],
                'slug' => $slug,
                'key' => $projectInfo['key'] ?? 'PROJ',
                'tagline' => $tagline,
                'color' => $projectInfo['color'] ?? '#2563eb',
                'description' => $projectInfo['description'] ?? '',
                'category' => 'Full-stack Platform',
                'workspace_id' => $options['workspace_id'] ?? null,
            ]);
        }

        if (!$project) {
            throw new RuntimeException('A project is required before generating tasks.');
        }

        $createdSprints = [];
        $createdTasks = [];

        $taskCounter = $project ? Task::where('project_id', $project->id)->count() + 1 : 1;
        $prefix = $project ? $project->effective_key : ($projectInfo['key'] ?? 'MCT');

        // 2. Iterate each Sprint
        foreach ($sprintsData as $sIndex => $sData) {
            $sprint = Sprint::create([
                'project_id' => $project->id,
                'name' => $sData['name'],
                'goal' => $sData['goal'] ?? null,
                'start_date' => $sData['start_date'] ?? null,
                'end_date' => $sData['end_date'] ?? null,
                'status' => $sIndex === 0 ? 'active' : 'future',
            ]);
            $createdSprints[] = $sprint;

            // 3. Create Tasks for this Sprint
            if (!empty($sData['tasks'])) {
                foreach ($sData['tasks'] as $tData) {
                    $issueKey = $prefix . '-' . $taskCounter++;

                    // Subtasks handling
                    $subtasks = [];
                    if (!empty($tData['subtasks']) && is_array($tData['subtasks'])) {
                        foreach ($tData['subtasks'] as $stIdx => $st) {
                            $subtasks[] = [
                                'id' => 'st-' . time() . '-' . rand(1000, 9999) . '-' . $stIdx,
                                'text' => is_array($st) ? ($st['text'] ?? '') : (string)$st,
                                'done' => false,
                            ];
                        }
                    }

                    $task = Task::create([
                        'project_id' => $project->id,
                        'issue_key' => $issueKey,
                        'issue_type' => $tData['issue_type'] ?? 'task',
                        'title' => $tData['title'],
                        'description' => $tData['description'] ?? null,
                        'status' => $tData['status'] ?? 'todo',
                        'priority' => $tData['priority'] ?? 'high',
                        'category' => $tData['category'] ?? 'backend',
                        'story_points' => $tData['story_points'] ?? 3,
                        'sprint_id' => $sprint->id,
                        'estimated_pomodoros' => $tData['estimated_pomodoros'] ?? 2,
                        'completed_pomodoros' => 0,
                        'start_date' => $tData['start_date'] ?? $sData['start_date'],
                        'due_date' => $tData['due_date'] ?? $sData['end_date'],
                        'notes' => count($subtasks) > 0 ? json_encode($subtasks) : null,
                    ]);

                    $task->load(['project', 'sprint']);
                    $createdTasks[] = $task;
                }
            }
        }

        return [
            'success' => true,
            'message' => 'The project was broken down and all sprints and tasks were created successfully.',
            'project_id' => $project ? $project->id : null,
            'sprint_ids' => array_map(fn($s) => $s->id, $createdSprints),
            'task_ids' => array_map(fn($t) => $t->id, $createdTasks),
            'project' => $project,
            'sprints' => $createdSprints,
            'tasks' => $createdTasks,
        ];
    }

    /** Validate and normalize provider output before preview or persistence. */
    public function normalizePlan(array $plan, array $options = []): array
    {
        if (!isset($plan['project']) || !is_array($plan['project']) || !isset($plan['sprints']) || !is_array($plan['sprints'])) {
            throw new RuntimeException('The project plan has an invalid structure.');
        }

        $project = $plan['project'];
        $project['title'] = trim((string) ($project['title'] ?? ''));
        if ($project['title'] === '') {
            throw new RuntimeException('The project plan must include a title.');
        }
        $project['key'] = strtoupper(substr((string) ($project['key'] ?? $this->inferProjectKey($project['title'])), 0, 10));
        $project['color'] = (string) ($project['color'] ?? '#2563eb');
        $project['description'] = (string) ($project['description'] ?? '');

        $sprints = [];
        foreach (array_values($plan['sprints']) as $index => $sprint) {
            if (!is_array($sprint) || trim((string) ($sprint['name'] ?? '')) === '') continue;
            $tasks = [];
            foreach (($sprint['tasks'] ?? []) as $task) {
                if (!is_array($task) || trim((string) ($task['title'] ?? '')) === '') continue;
                $tasks[] = [
                    'issue_type' => in_array(($task['issue_type'] ?? 'task'), ['epic', 'story', 'task', 'bug'], true) ? $task['issue_type'] : 'task',
                    'title' => trim((string) $task['title']),
                    'description' => (string) ($task['description'] ?? ''),
                    'priority' => in_array(($task['priority'] ?? 'medium'), ['urgent', 'high', 'medium', 'low'], true) ? $task['priority'] : 'medium',
                    'category' => trim((string) ($task['category'] ?? 'general')) ?: 'general',
                    'story_points' => max(0, min(100, (int) ($task['story_points'] ?? 1))),
                    'status' => in_array(($task['status'] ?? 'todo'), ['todo', 'in_progress'], true) ? $task['status'] : 'todo',
                    'estimated_pomodoros' => max(1, min(20, (int) ($task['estimated_pomodoros'] ?? 1))),
                    'start_date' => $task['start_date'] ?? $sprint['start_date'] ?? null,
                    'due_date' => $task['due_date'] ?? $sprint['end_date'] ?? null,
                    'subtasks' => is_array($task['subtasks'] ?? null) ? array_slice($task['subtasks'], 0, 20) : [],
                ];
            }
            $sprints[] = [
                'name' => trim((string) $sprint['name']),
                'goal' => (string) ($sprint['goal'] ?? ''),
                'start_date' => $sprint['start_date'] ?? null,
                'end_date' => $sprint['end_date'] ?? null,
                'status' => $index === 0 ? 'active' : 'future',
                'tasks' => $tasks,
            ];
        }

        if ($sprints === []) throw new RuntimeException('The project plan must include at least one sprint.');

        $tasks = collect($sprints)->flatMap(fn (array $sprint) => $sprint['tasks']);
        $startDate = $sprints[0]['start_date'] ?? ($options['start_date'] ?? Carbon::today()->toDateString());

        return [
            'success' => true,
            'project' => $project,
            'summary' => [
                'sprint_count' => count($sprints),
                'total_tasks' => $tasks->count(),
                'total_story_points' => $tasks->sum('story_points'),
                'total_pomodoros' => $tasks->sum('estimated_pomodoros'),
                'estimated_weeks' => max(1, (int) ($options['sprint_duration_weeks'] ?? 2)) * count($sprints),
                'start_date' => $startDate,
                'end_date' => $sprints[array_key_last($sprints)]['end_date'] ?? $startDate,
            ],
            'sprints' => $sprints,
        ];
    }

    public function planningSettings(): array
    {
        $encryptedKey = \App\Models\SiteSetting::get('tasks_ai_api_key');
        $apiKey = null;
        if ($encryptedKey) {
            try { $apiKey = Crypt::decryptString($encryptedKey); } catch (\Throwable) { $apiKey = null; }
        }

        return [
            'provider' => \App\Models\SiteSetting::get('tasks_ai_provider', 'template'),
            'base_url' => \App\Models\SiteSetting::get('tasks_ai_base_url', 'https://api.openai.com/v1'),
            'model' => \App\Models\SiteSetting::get('tasks_ai_model', 'gpt-4o-mini'),
            'temperature' => (float) \App\Models\SiteSetting::get('tasks_ai_temperature', '0.2'),
            'api_key' => $apiKey,
        ];
    }

    /**
     * Helper to infer project title from prompt.
     */
    protected function inferProjectTitle(string $prompt): string
    {
        $firstLine = trim(explode("\n", $prompt)[0]);
        if (mb_strlen($firstLine) <= 50 && mb_strlen($firstLine) >= 4) {
            return $firstLine;
        }

        $clean = preg_replace('/^(xây dựng|phát triển|thiết kế|lập kế hoạch|dự án|tạo)\s+/iu', '', $firstLine);
        $words = explode(' ', $clean);
        $titleWords = array_slice($words, 0, 6);
        $title = implode(' ', $titleWords);

        return !empty($title) ? Str::title($title) : 'New Software Project';
    }

    /**
     * Helper to infer 3-4 letter project key.
     */
    protected function inferProjectKey(string $title): string
    {
        $words = preg_split('/[\s\-_]+/', $title);
        $key = '';
        foreach ($words as $w) {
            if (!empty($w)) {
                $key .= mb_substr($w, 0, 1);
            }
        }
        $key = strtoupper(preg_replace('/[^A-Z0-9]/', '', $key));
        if (strlen($key) < 2) {
            $key = 'PRJ';
        }
        return substr($key, 0, 4);
    }

    /**
     * Domain keyword analysis.
     */
    protected function analyzeDomains(string $prompt): array
    {
        $text = mb_strtolower($prompt);
        return [
            'has_auth' => Str::contains($text, ['auth', 'đăng nhập', 'jwt', 'oauth', 'phân quyền', 'permission', 'security', 'mật khẩu', 'tài khoản']),
            'has_payment' => Str::contains($text, ['thanh toán', 'payment', 'vnpay', 'momo', 'stripe', 'checkout', 'ví']),
            'has_mobile' => Str::contains($text, ['mobile', 'flutter', 'react native', 'ios', 'android', 'app điện thoại']),
            'has_ai' => Str::contains($text, ['ai', 'gemini', 'openai', 'llm', 'chat', 'bot', 'trí tuệ nhân tạo', 'machine learning', 'prompt']),
            'has_api' => Str::contains($text, ['api', 'rest', 'graphql', 'endpoint', 'webhook', 'tích hợp']),
            'has_database' => Str::contains($text, ['database', 'csdl', 'sql', 'mysql', 'postgres', 'sqlite', 'schema', 'migration', 'redis']),
            'has_devops' => Str::contains($text, ['docker', 'deploy', 'k8s', 'cloud', 'ci/cd', 'pipeline', 'server', 'vps', 'aws', 'gcp']),
            'has_frontend' => Str::contains($text, ['giao diện', 'ui', 'ux', 'vue', 'react', 'tailwind', 'dashboard', 'frontend', 'bảng điều khiển']),
            'has_ecommerce' => Str::contains($text, ['thương mại điện tử', 'bán hàng', 'sản phẩm', 'giỏ hàng', 'đơn hàng', 'kho hàng', 'order', 'e-commerce']),
            'has_realtime' => Str::contains($text, ['realtime', 'websocket', 'thông báo', 'live', 'socket', 'trực tiếp']),
        ];
    }

    /**
     * Generate structured sprints and tasks based on analyzed prompt.
     */
    protected function buildSprintsAndTasks(
        string $prompt,
        string $projectTitle,
        string $projectKey,
        int $sprintCount,
        int $sprintWeeks,
        Carbon $startDate,
        array $domains
    ): array {
        $sprints = [];

        // Sprint 1: Foundation, Platform Structure & MVP Architecture
        $sprint1Start = $startDate->copy();
        $sprint1End = $sprint1Start->copy()->addWeeks($sprintWeeks);

        $sprint1Tasks = [
            [
                'issue_type' => 'epic',
                'title' => "Platform Foundation & Core Architecture ({$projectTitle})",
                'description' => "Set up the database structure, environment infrastructure, and initial system design standards.\n\n### Acceptance Criteria:\n- Complete the database schema and migrations\n- Prepare dev and staging environments\n- Establish coding conventions and a CI baseline",
                'priority' => 'urgent',
                'category' => 'backend',
                'story_points' => 8,
                'status' => 'in_progress',
                'estimated_pomodoros' => 6,
                'start_date' => $sprint1Start->toDateString(),
                'due_date' => $sprint1Start->copy()->addDays(4)->toDateString(),
                'subtasks' => [
                    ['text' => 'Analyze and design the data ERD'],
                    ['text' => 'Create migrations and model relationships'],
                    ['text' => 'Configure .env variables and Docker containers'],
                ],
            ],
            [
                'issue_type' => 'story',
                'title' => 'Build User Authentication & Authorization',
                'description' => "Implement registration and sign-in, JWT/session security, and RBAC access control.\n\n### Acceptance Criteria:\n- Support secure sign-in with rate limiting\n- Middleware separates administrator and regular-user permissions\n- Authentication test cases pass at 100%",
                'priority' => 'high',
                'category' => 'backend',
                'story_points' => 5,
                'status' => 'todo',
                'estimated_pomodoros' => 4,
                'start_date' => $sprint1Start->copy()->addDays(2)->toDateString(),
                'due_date' => $sprint1Start->copy()->addDays(7)->toDateString(),
                'subtasks' => [
                    ['text' => 'Registration, sign-in, and token revocation APIs'],
                    ['text' => 'Session and bearer-token middleware'],
                    ['text' => 'Password recovery and email verification'],
                ],
            ],
            [
                'issue_type' => 'story',
                'title' => 'Build the Core Interface & High-Contrast Theme',
                'description' => "Build the primary interface with a high-contrast color system and dark/light mode support.\n\n### Acceptance Criteria:\n- Responsive behavior across mobile, tablet, and desktop\n- Smooth theme switching without flicker\n- Consistent icon and typography system",
                'priority' => 'high',
                'category' => 'frontend',
                'story_points' => 5,
                'status' => 'todo',
                'estimated_pomodoros' => 4,
                'start_date' => $sprint1Start->copy()->addDays(3)->toDateString(),
                'due_date' => $sprint1End->toDateString(),
                'subtasks' => [
                    ['text' => 'Build responsive header navigation and sidebar'],
                    ['text' => 'Add dark/light theme switching with LocalStorage sync'],
                    ['text' => 'Design UI components: buttons, modals, cards, and badges'],
                ],
            ],
            [
                'issue_type' => 'task',
                'title' => 'Configure the CI/CD Pipeline & Automated Health Checks',
                'description' => "Configure GitHub Actions or Cloud Build to run tests and deploy preview builds automatically.\n\n```yaml\nname: Automated Pipeline\non: [push, pull_request]\n```",
                'priority' => 'medium',
                'category' => 'infra',
                'story_points' => 3,
                'status' => 'todo',
                'estimated_pomodoros' => 2,
                'start_date' => $sprint1Start->copy()->addDays(4)->toDateString(),
                'due_date' => $sprint1End->toDateString(),
                'subtasks' => [
                    ['text' => 'Write the automated test workflow'],
                    ['text' => 'Create a docker-compose file for local testing'],
                ],
            ],
        ];

        // Add domain specific tasks to Sprint 1 if detected
        if ($domains['has_database']) {
            $sprint1Tasks[] = [
                'issue_type' => 'task',
                'title' => 'Design the Database Schema & Optimized Indexes',
                'description' => "Optimize database tables and add indexes for frequently queried fields and foreign keys.",
                'priority' => 'high',
                'category' => 'backend',
                'story_points' => 3,
                'status' => 'todo',
                'estimated_pomodoros' => 3,
                'start_date' => $sprint1Start->copy()->addDays(1)->toDateString(),
                'due_date' => $sprint1Start->copy()->addDays(5)->toDateString(),
                'subtasks' => [
                    ['text' => 'Create migrations for core business tables'],
                    ['text' => 'Write database seeders with sample data'],
                ],
            ];
        }

        $sprints[] = [
            'name' => 'Sprint 1 — Platform Foundation & MVP Architecture',
            'goal' => "Complete the architecture, database, authentication, and core interface foundation for {$projectTitle}.",
            'start_date' => $sprint1Start->toDateString(),
            'end_date' => $sprint1End->toDateString(),
            'status' => 'active',
            'tasks' => $sprint1Tasks,
        ];

        if ($sprintCount >= 2) {
            // Sprint 2: Core Business Logic
            $sprint2Start = $sprint1End->copy();
            $sprint2End = $sprint2Start->copy()->addWeeks($sprintWeeks);

            $sprint2Tasks = [
                [
                    'issue_type' => 'epic',
                    'title' => "Build Core Business Features ({$projectTitle})",
                    'description' => "Build the core business flows required by the project.\n\n### Completion Criteria:\n- Data flows work end to end\n- Client and server validation is strict and consistent",
                    'priority' => 'urgent',
                    'category' => 'backend',
                    'story_points' => 8,
                    'status' => 'todo',
                    'estimated_pomodoros' => 6,
                    'start_date' => $sprint2Start->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Build business services and repositories'],
                        ['text' => 'Write controllers and form-request validation'],
                    ],
                ],
                [
                    'issue_type' => 'story',
                    'title' => 'Build the Data Administration & Analytics Dashboard',
                    'description' => "Create a smart management interface with instant search filters, flexible pagination, and clear analytics.\n\n### Acceptance Criteria:\n- Instant search and date/status filtering\n- KPI charts and summary metrics",
                    'priority' => 'high',
                    'category' => 'frontend',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 4,
                    'start_date' => $sprint2Start->copy()->addDays(2)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Create a sortable and paginated data grid'],
                        ['text' => 'Add clear analytics charts'],
                        ['text' => 'Create a detail view/edit modal'],
                    ],
                ],
            ];

            if ($domains['has_payment']) {
                $sprint2Tasks[] = [
                    'issue_type' => 'story',
                    'title' => 'Integrate the Online Payment Gateway (VNPay/Momo/Stripe)',
                    'description' => "Build a secure payment gateway with IPN webhooks and automated transaction reconciliation.",
                    'priority' => 'urgent',
                    'category' => 'backend',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 4,
                    'start_date' => $sprint2Start->copy()->addDays(3)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Create HMAC-SHA512 security signatures'],
                        ['text' => 'Build return URL and IPN callback endpoints'],
                        ['text' => 'Store transaction history and receipt logs'],
                    ],
                ];
            }

            if ($domains['has_ai']) {
                $sprint2Tasks[] = [
                    'issue_type' => 'story',
                    'title' => 'Integrate the AI Engine & Natural Language Processing (LLM)',
                    'description' => "Connect Gemini/OpenAI APIs, stream responses, and provide intelligent suggestions.",
                    'priority' => 'high',
                    'category' => 'ai_agent',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 4,
                    'start_date' => $sprint2Start->copy()->addDays(2)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Design a consistent system prompt'],
                        ['text' => 'Process streaming SSE responses'],
                        ['text' => 'Add result fallback and caching'],
                    ],
                ];
            }

            if ($domains['has_mobile']) {
                $sprint2Tasks[] = [
                    'issue_type' => 'story',
                    'title' => 'Build Mobile Screens & Flows with Flutter/React Native',
                    'description' => "Synchronize the mobile interface, add offline caching, and connect the REST API.",
                    'priority' => 'high',
                    'category' => 'frontend',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 4,
                    'start_date' => $sprint2Start->copy()->addDays(4)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Build the primary mobile screen flow'],
                        ['text' => 'Integrate state management (Pinia/Bloc/Redux)'],
                    ],
                ];
            }

            if ($domains['has_realtime']) {
                $sprint2Tasks[] = [
                    'issue_type' => 'task',
                    'title' => 'Configure Realtime WebSocket Broadcasts & Notifications',
                    'description' => "Broadcast realtime events through Laravel WebSockets/Pusher without page reloads.",
                    'priority' => 'medium',
                    'category' => 'infra',
                    'story_points' => 3,
                    'status' => 'todo',
                    'estimated_pomodoros' => 3,
                    'start_date' => $sprint2Start->copy()->addDays(5)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Create broadcast events'],
                        ['text' => 'Listen for events in the Vue/JS client'],
                    ],
                ];
            }

            $sprints[] = [
                'name' => 'Sprint 2 — Core Business Development',
                'goal' => "Deliver the core flows, integrate APIs, and complete the dashboard for {$projectTitle}.",
                'start_date' => $sprint2Start->toDateString(),
                'end_date' => $sprint2End->toDateString(),
                'status' => 'future',
                'tasks' => $sprint2Tasks,
            ];
        }

        if ($sprintCount >= 3) {
            // Sprint 3: Optimization, Testing, Security & Production Release
            $sprint3Start = $sprint1End->copy()->addWeeks($sprintWeeks * ($sprintCount - 2));
            $sprint3End = $sprint3Start->copy()->addWeeks($sprintWeeks);

            $sprint3Tasks = [
                [
                    'issue_type' => 'epic',
                    'title' => "Polish, Comprehensive Testing & Production Release",
                    'description' => "Ensure product quality, eliminate critical issues, and prepare the system for operations handoff.",
                    'priority' => 'urgent',
                    'category' => 'qa',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 5,
                    'start_date' => $sprint3Start->toDateString(),
                    'due_date' => $sprint3End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Black-box test all user flows'],
                        ['text' => 'Audit OWASP Top 10 security and CSRF/XSS protection'],
                    ],
                ],
                [
                    'issue_type' => 'task',
                    'title' => 'Optimize Page Load Speed & Advanced Caching',
                    'description' => "Compress images, optimize SQL queries and eager loading, enable Redis caching, and optimize the Vite bundle.",
                    'priority' => 'high',
                    'category' => 'backend',
                    'story_points' => 3,
                    'status' => 'todo',
                    'estimated_pomodoros' => 3,
                    'start_date' => $sprint3Start->copy()->addDays(1)->toDateString(),
                    'due_date' => $sprint3Start->copy()->addDays(5)->toDateString(),
                    'subtasks' => [
                        ['text' => 'Eliminate N+1 queries from primary screens'],
                        ['text' => 'Configure HTTP caching and Gzip/Brotli compression'],
                        ['text' => 'Reach a Lighthouse score of at least 90'],
                    ],
                ],
                [
                    'issue_type' => 'bug',
                    'title' => 'Review the Interface on Small Mobile Devices',
                    'description' => "Fix layout breaks, horizontal overflow, and font issues on iPhone SE and small Android screens.",
                    'priority' => 'medium',
                    'category' => 'frontend',
                    'story_points' => 2,
                    'status' => 'todo',
                    'estimated_pomodoros' => 2,
                    'start_date' => $sprint3Start->copy()->addDays(3)->toDateString(),
                    'due_date' => $sprint3Start->copy()->addDays(6)->toDateString(),
                    'subtasks' => [
                        ['text' => 'Test 375px and 320px viewport widths'],
                        ['text' => 'Optimize touch target sizes (minimum 44px)'],
                    ],
                ],
                [
                    'issue_type' => 'task',
                    'title' => 'Deploy Production & Configure Automated Backups',
                    'description' => "Configure the production domain, HTTPS certificate, Nginx reverse proxy, and daily database backups.",
                    'priority' => 'urgent',
                    'category' => 'infra',
                    'story_points' => 3,
                    'status' => 'todo',
                    'estimated_pomodoros' => 3,
                    'start_date' => $sprint3Start->copy()->addDays(4)->toDateString(),
                    'due_date' => $sprint3End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Install an auto-renewing SSL certificate'],
                        ['text' => 'Back up the database automatically to Cloud Storage'],
                        ['text' => 'Verify the production environment in practice'],
                    ],
                ],
            ];

            $sprints[] = [
                'name' => "Sprint {$sprintCount} — Optimization, Testing & Production Release",
                'goal' => "Run regression tests, audit security, optimize performance, and officially launch {$projectTitle}.",
                'start_date' => $sprint3Start->toDateString(),
                'end_date' => $sprint3End->toDateString(),
                'status' => 'future',
                'tasks' => $sprint3Tasks,
            ];
        }

        return $sprints;
    }
}
