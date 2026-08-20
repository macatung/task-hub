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
        $projectType = $options['project_type'] ?? 'work';
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
                'type' => $projectType,
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

        if ($projectId && $projectId !== 'new' && $projectId !== 'all' && $projectId !== 'unassigned') {
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
                'type' => $projectInfo['type'] ?? 'work',
                'color' => $projectInfo['color'] ?? '#2563eb',
                'description' => $projectInfo['description'] ?? '',
                'category' => 'Full-stack Platform',
            ]);
        }

        $createdSprints = [];
        $createdTasks = [];

        $taskCounter = $project ? Task::where('project_id', $project->id)->count() + 1 : 1;
        $prefix = $project ? $project->effective_key : ($projectInfo['key'] ?? 'MCT');

        // 2. Iterate each Sprint
        foreach ($sprintsData as $sIndex => $sData) {
            $sprint = Sprint::create([
                'project_id' => $project ? $project->id : null,
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
                        'project_id' => $project ? $project->id : null,
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
            'message' => 'Đã tự động phân rã dự án và tạo toàn bộ Sprints & Tasks thành công!',
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
        $project['type'] = in_array(($project['type'] ?? 'work'), ['work', 'personal'], true) ? $project['type'] : 'work';
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

        return !empty($title) ? Str::title($title) : 'Dự Án Phần Mềm Mới';
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

        // Sprint 1: Khởi tạo, Cấu trúc Nền tảng & MVP Architecture
        $sprint1Start = $startDate->copy();
        $sprint1End = $sprint1Start->copy()->addWeeks($sprintWeeks);

        $sprint1Tasks = [
            [
                'issue_type' => 'epic',
                'title' => "Khởi tạo Nền tảng & Kiến trúc Cốt lõi ({$projectTitle})",
                'description' => "Thiết lập cấu trúc cơ sở dữ liệu, hạ tầng môi trường và các chuẩn thiết kế hệ thống ban đầu.\n\n### Tiêu chí nghiệm thu (Acceptance Criteria):\n- Hoàn thiện schema CSDL & migration\n- Cấu hình môi trường dev & staging sẵn sàng\n- Thiết lập chuẩn Coding Conventions và CI baseline",
                'priority' => 'urgent',
                'category' => 'backend',
                'story_points' => 8,
                'status' => 'in_progress',
                'estimated_pomodoros' => 6,
                'start_date' => $sprint1Start->toDateString(),
                'due_date' => $sprint1Start->copy()->addDays(4)->toDateString(),
                'subtasks' => [
                    ['text' => 'Khảo sát và thiết kế sơ đồ ERD dữ liệu'],
                    ['text' => 'Tạo migrations và model relationships'],
                    ['text' => 'Cấu hình biến môi trường .env và Docker container'],
                ],
            ],
            [
                'issue_type' => 'story',
                'title' => 'Xây dựng Hệ thống Xác thực & Phân quyền Người Dùng',
                'description' => "Triển khai cơ chế Đăng ký / Đăng nhập, bảo mật JWT/Session và kiểm soát quyền truy cập RBAC.\n\n### Acceptance Criteria:\n- Hỗ trợ đăng nhập an toàn với rate limiting\n- Middleware phân quyền quản trị viên vs người dùng thường\n- Test cases xác thực đạt 100% pass",
                'priority' => 'high',
                'category' => 'backend',
                'story_points' => 5,
                'status' => 'todo',
                'estimated_pomodoros' => 4,
                'start_date' => $sprint1Start->copy()->addDays(2)->toDateString(),
                'due_date' => $sprint1Start->copy()->addDays(7)->toDateString(),
                'subtasks' => [
                    ['text' => 'API Đăng ký, Đăng nhập & Thu hồi Token'],
                    ['text' => 'Middleware kiểm tra Session/Bearer Token'],
                    ['text' => 'Xử lý khôi phục mật khẩu & xác thực email'],
                ],
            ],
            [
                'issue_type' => 'story',
                'title' => 'Thiết lập Giao diện Cơ bản & Layout Theme High Contrast',
                'description' => "Xây dựng khung giao diện chính với hệ thống màu sắc tương phản cao, hỗ trợ cả Dark Mode và Light Mode.\n\n### Acceptance Criteria:\n- Responsive hoàn hảo trên Mobile, Tablet và Desktop\n- Theme toggle mượt mà không bị flicker\n- Tích hợp bộ icon và font typography chuẩn",
                'priority' => 'high',
                'category' => 'frontend',
                'story_points' => 5,
                'status' => 'todo',
                'estimated_pomodoros' => 4,
                'start_date' => $sprint1Start->copy()->addDays(3)->toDateString(),
                'due_date' => $sprint1End->toDateString(),
                'subtasks' => [
                    ['text' => 'Xây dựng Header Navigation & Sidebar responsive'],
                    ['text' => 'Tích hợp Dark/Light theme toggle và LocalStorage sync'],
                    ['text' => 'Thiết kế các UI components: Button, Modal, Card, Badge'],
                ],
            ],
            [
                'issue_type' => 'task',
                'title' => 'Cấu hình CI/CD Pipeline & Automated Healthcheck',
                'description' => "Thiết lập GitHub Actions hoặc Cloud Build tự động chạy test và deploy bản build thử nghiệm.\n\n```yaml\nname: Automated Pipeline\non: [push, pull_request]\n```",
                'priority' => 'medium',
                'category' => 'infra',
                'story_points' => 3,
                'status' => 'todo',
                'estimated_pomodoros' => 2,
                'start_date' => $sprint1Start->copy()->addDays(4)->toDateString(),
                'due_date' => $sprint1End->toDateString(),
                'subtasks' => [
                    ['text' => 'Viết workflow test tự động'],
                    ['text' => 'Tạo docker-compose file cho local testing'],
                ],
            ],
        ];

        // Add domain specific tasks to Sprint 1 if detected
        if ($domains['has_database']) {
            $sprint1Tasks[] = [
                'issue_type' => 'task',
                'title' => 'Thiết kế Schema & Migration CSDL Tối Ưu Index',
                'description' => "Tối ưu hóa bảng CSDL, tạo index trên các trường query thường xuyên và foreign keys.",
                'priority' => 'high',
                'category' => 'backend',
                'story_points' => 3,
                'status' => 'todo',
                'estimated_pomodoros' => 3,
                'start_date' => $sprint1Start->copy()->addDays(1)->toDateString(),
                'due_date' => $sprint1Start->copy()->addDays(5)->toDateString(),
                'subtasks' => [
                    ['text' => 'Tạo migration các bảng nghiệp vụ chính'],
                    ['text' => 'Viết Database Seeders dữ liệu mẫu'],
                ],
            ];
        }

        $sprints[] = [
            'name' => 'Sprint 1 — Khởi Tạo Nền Tảng & MVP Architecture',
            'goal' => "Hoàn thành bộ khung kiến trúc, CSDL và hệ thống đăng nhập/giao diện nền tảng cho {$projectTitle}.",
            'start_date' => $sprint1Start->toDateString(),
            'end_date' => $sprint1End->toDateString(),
            'status' => 'active',
            'tasks' => $sprint1Tasks,
        ];

        if ($sprintCount >= 2) {
            // Sprint 2: Phát Triển Nghiệp Vụ Cốt Lõi (Core Business Logic)
            $sprint2Start = $sprint1End->copy();
            $sprint2End = $sprint2Start->copy()->addWeeks($sprintWeeks);

            $sprint2Tasks = [
                [
                    'issue_type' => 'epic',
                    'title' => "Phát triển Tính Năng Nghiệp Vụ Trọng Tâm ({$projectTitle})",
                    'description' => "Xây dựng toàn bộ các luồng nghiệp vụ cốt lõi theo yêu cầu dự án.\n\n### Tiêu chí hoàn thành:\n- Luồng dữ liệu hoạt động trơn tru end-to-end\n- Validate dữ liệu chặt chẽ ở cả client và server",
                    'priority' => 'urgent',
                    'category' => 'backend',
                    'story_points' => 8,
                    'status' => 'todo',
                    'estimated_pomodoros' => 6,
                    'start_date' => $sprint2Start->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Xây dựng Business Services & Repositories'],
                        ['text' => 'Viết Controllers & Form Requests validation'],
                    ],
                ],
                [
                    'issue_type' => 'story',
                    'title' => 'Xây dựng Bảng Quản Trị Dữ Liệu & Dashboard Analytics',
                    'description' => "Giao diện quản lý thông minh với bộ lọc tìm kiếm tức thời, phân trang linh hoạt và thống kê trực quan.\n\n### Acceptance Criteria:\n- Tìm kiếm, lọc theo ngày/trạng thái tức thời\n- Biểu đồ thống kê và tóm tắt chỉ số KPI",
                    'priority' => 'high',
                    'category' => 'frontend',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 4,
                    'start_date' => $sprint2Start->copy()->addDays(2)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Tạo bảng dữ liệu Data Grid có sorting & pagination'],
                        ['text' => 'Tích hợp biểu đồ thống kê trực quan'],
                        ['text' => 'Tạo Modal xem/sửa chi tiết'],
                    ],
                ],
            ];

            if ($domains['has_payment']) {
                $sprint2Tasks[] = [
                    'issue_type' => 'story',
                    'title' => 'Tích hợp Cổng Thanh Toán Trực Tuyến (VNPay/Momo/Stripe)',
                    'description' => "Xây dựng cổng thanh toán an toàn, xử lý IPN Webhook và đối soát giao dịch tự động.",
                    'priority' => 'urgent',
                    'category' => 'backend',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 4,
                    'start_date' => $sprint2Start->copy()->addDays(3)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Tạo chữ ký bảo mật HMAC-SHA512 checksum'],
                        ['text' => 'Endpoint xử lý Return URL và IPN Callback'],
                        ['text' => 'Lưu log lịch sử giao dịch và biên lai'],
                    ],
                ];
            }

            if ($domains['has_ai']) {
                $sprint2Tasks[] = [
                    'issue_type' => 'story',
                    'title' => 'Tích hợp AI Engine & Xử Lý Ngôn Ngữ Tự Nhiên (LLM)',
                    'description' => "Kết nối API trí tuệ nhân tạo (Gemini / OpenAI), xử lý stream response và gợi ý thông minh.",
                    'priority' => 'high',
                    'category' => 'ai_agent',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 4,
                    'start_date' => $sprint2Start->copy()->addDays(2)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Thiết kế System Prompt chuẩn mực'],
                        ['text' => 'Xử lý streaming SSE phản hồi thời gian thực'],
                        ['text' => 'Cơ chế fallback và caching kết quả'],
                    ],
                ];
            }

            if ($domains['has_mobile']) {
                $sprint2Tasks[] = [
                    'issue_type' => 'story',
                    'title' => 'Phát triển Màn Hình & Luồng Ứng Dụng Mobile Flutter/React Native',
                    'description' => "Đồng bộ giao diện mobile, lưu cache offline và kết nối REST API.",
                    'priority' => 'high',
                    'category' => 'frontend',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 4,
                    'start_date' => $sprint2Start->copy()->addDays(4)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Xây dựng luồng màn hình chính'],
                        ['text' => 'Tích hợp State Management (Pinia/Bloc/Redux)'],
                    ],
                ];
            }

            if ($domains['has_realtime']) {
                $sprint2Tasks[] = [
                    'issue_type' => 'task',
                    'title' => 'Cấu hình WebSocket Realtime Broadcast & Thông Báo',
                    'description' => "Phát sự kiện realtime qua Laravel WebSockets/Pusher tới client mà không cần reload trang.",
                    'priority' => 'medium',
                    'category' => 'infra',
                    'story_points' => 3,
                    'status' => 'todo',
                    'estimated_pomodoros' => 3,
                    'start_date' => $sprint2Start->copy()->addDays(5)->toDateString(),
                    'due_date' => $sprint2End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Tạo Broadcast Events'],
                        ['text' => 'Lắng nghe sự kiện trên client Vue/JS'],
                    ],
                ];
            }

            $sprints[] = [
                'name' => 'Sprint 2 — Phát Triển Nghiệp Vụ Cốt Lõi',
                'goal' => "Triển khai đầy đủ các luồng chức năng trọng tâm, tích hợp API và hoàn thiện Dashboard cho {$projectTitle}.",
                'start_date' => $sprint2Start->toDateString(),
                'end_date' => $sprint2End->toDateString(),
                'status' => 'future',
                'tasks' => $sprint2Tasks,
            ];
        }

        if ($sprintCount >= 3) {
            // Sprint 3: Tối Ưu Hóa, Kiểm Thử, Bảo Mật & Triển Khai (Polish & Production Release)
            $sprint3Start = $sprint1End->copy()->addWeeks($sprintWeeks * ($sprintCount - 2));
            $sprint3End = $sprint3Start->copy()->addWeeks($sprintWeeks);

            $sprint3Tasks = [
                [
                    'issue_type' => 'epic',
                    'title' => "Hoàn Thiện, Kiểm Thử Toàn Diện & Triển Khai Production",
                    'description' => "Đảm bảo chất lượng sản phẩm đạt chuẩn quốc tế, không còn lỗi nghiêm trọng và sẵn sàng bàn giao vận hành.",
                    'priority' => 'urgent',
                    'category' => 'qa',
                    'story_points' => 5,
                    'status' => 'todo',
                    'estimated_pomodoros' => 5,
                    'start_date' => $sprint3Start->toDateString(),
                    'due_date' => $sprint3End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Kiểm thử hộp đen (Black-box testing) tất cả user flows'],
                        ['text' => 'Audit bảo mật OWASP Top 10 và bảo vệ CSRF/XSS'],
                    ],
                ],
                [
                    'issue_type' => 'task',
                    'title' => 'Tối Ưu Tốc Độ Tải Trang & Caching Nâng Cao',
                    'description' => "Nén hình ảnh, tối ưu câu truy vấn SQL (Eager loading N+1), bật Redis cache và tối ưu bundle Vite.",
                    'priority' => 'high',
                    'category' => 'backend',
                    'story_points' => 3,
                    'status' => 'todo',
                    'estimated_pomodoros' => 3,
                    'start_date' => $sprint3Start->copy()->addDays(1)->toDateString(),
                    'due_date' => $sprint3Start->copy()->addDays(5)->toDateString(),
                    'subtasks' => [
                        ['text' => 'Khử triệt để N+1 query trên các màn hình chính'],
                        ['text' => 'Cấu hình HTTP Caching & Gzip/Brotli compression'],
                        ['text' => 'Đo điểm Lighthouse đạt tối thiểu 90+'],
                    ],
                ],
                [
                    'issue_type' => 'bug',
                    'title' => 'Rà Soát Lỗi Hiển Thị Giao Diện Trên Các Thiết Bị Di Động Nhỏ',
                    'description' => "Fix triệt để các vấn đề vỡ khung, tràn viền (overflow-x) và lỗi font trên màn hình iPhone SE / Android nhỏ.",
                    'priority' => 'medium',
                    'category' => 'frontend',
                    'story_points' => 2,
                    'status' => 'todo',
                    'estimated_pomodoros' => 2,
                    'start_date' => $sprint3Start->copy()->addDays(3)->toDateString(),
                    'due_date' => $sprint3Start->copy()->addDays(6)->toDateString(),
                    'subtasks' => [
                        ['text' => 'Kiểm tra trên màn hình 375px và 320px'],
                        ['text' => 'Tối ưu kích thước nút bấm cảm ứng (min 44px)'],
                    ],
                ],
                [
                    'issue_type' => 'task',
                    'title' => 'Triển Khai Môi Trường Production & Thiết Lập Sao Lưu Tự Động',
                    'description' => "Cấu hình domain chính thức, SSL HTTPS certificate, Nginx reverse proxy và cronjob backup CSDL hàng ngày.",
                    'priority' => 'urgent',
                    'category' => 'infra',
                    'story_points' => 3,
                    'status' => 'todo',
                    'estimated_pomodoros' => 3,
                    'start_date' => $sprint3Start->copy()->addDays(4)->toDateString(),
                    'due_date' => $sprint3End->toDateString(),
                    'subtasks' => [
                        ['text' => 'Cài đặt chứng chỉ SSL tự động gia hạn'],
                        ['text' => 'Thiết lập script sao lưu CSDL tự động lên Cloud Storage'],
                        ['text' => 'Kiểm tra hoạt động thực tế trên production'],
                    ],
                ],
            ];

            $sprints[] = [
                'name' => "Sprint {$sprintCount} — Tối Ưu, Kiểm Thử & Triển Khai Production",
                'goal' => "Kiểm thử hồi quy, audit bảo mật, tối ưu hiệu năng và ra mắt chính thức {$projectTitle}.",
                'start_date' => $sprint3Start->toDateString(),
                'end_date' => $sprint3End->toDateString(),
                'status' => 'future',
                'tasks' => $sprint3Tasks,
            ];
        }

        return $sprints;
    }
}
