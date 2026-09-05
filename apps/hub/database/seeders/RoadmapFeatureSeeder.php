<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Project;
use App\Models\Workspace;
use App\Models\Sprint;
use App\Models\Task;
use Carbon\Carbon;

class RoadmapFeatureSeeder extends Seeder
{
    /**
     * Seed Task Hub Strategic Roadmap & Feature Backlog (24 features across 6 Epics).
     */
    public function run(): void
    {
        $now = Carbon::now();

        // 1. Resolve Target Workspace and Project
        $workspace = Workspace::where('slug', 'like', '%workspace-1%')
            ->orWhere('name', 'like', '%macatung%')
            ->first() ?? Workspace::first();

        $project = Project::where('id', 1)
            ->orWhere('key', 'TH')
            ->orWhere('slug', 'like', '%task-hub%')
            ->first() ?? Project::firstOrCreate(
                ['slug' => 'task-hub-roadmap-evolution'],
                [
                    'key' => 'TH',
                    'title' => 'Task Hub Roadmap & Evolution',
                    'tagline' => 'Lộ trình phát triển tính năng chiến lược Task Hub 2026 - 2027',
                    'description' => 'Dự án theo dõi và triển khai 24 tính năng trọng điểm thuộc 6 Epics chiến lược trên cả 3 trụ cột: Desktop Simple To-Do, Desktop Dev Multi-Agent Orchestrator, và Web Hub Cloud SaaS.',
                    'category' => 'engineering',
                    'color' => '#00f5a0',
                    'cover_gradient' => 'linear-gradient(135deg, #04070d 0%, #070b14 50%, #00f5a0 100%)',
                    'tags' => ['roadmap', 'desktop', 'ai-agents', 'saas', 'vue3', 'laravel', 'p0-must-have'],
                    'tech_stack' => ['Vue 3.5', 'Electron 34', 'Tailwind v4', 'Laravel 11', 'CAO (AWS Labs)', 'WebSockets'],
                    'architecture_highlights' => 'Dual-mode Desktop architecture (Simple Office vs Developer Orchestrator) + Cloud Web Hub with real-time sync.',
                    'featured' => true,
                    'order' => 1,
                    'workspace_id' => $workspace?->id,
                    'user_id' => $workspace?->owner_id,
                ]
            );

        if (!$project->workspace_id && $workspace) {
            $project->workspace_id = $workspace->id;
            $project->save();
        }

        $workspaceId = $project->workspace_id ?? $workspace?->id;

        // 2. Create Sprints for Roadmap Phases
        $sprintQ3 = Sprint::firstOrCreate(
            ['name' => 'Sprint Q3 2026 — Fast Capture & Focus Foundation', 'project_id' => $project->id],
            [
                'workspace_id' => $workspaceId,
                'goal' => 'Hoàn thiện trải nghiệm ghi việc tức thì, thông báo Windows, Kanban cơ bản và tự động hóa PR.',
                'start_date' => Carbon::parse('2026-07-01')->toDateString(),
                'end_date' => Carbon::parse('2026-09-30')->toDateString(),
                'status' => 'active',
            ]
        );

        $sprintQ4 = Sprint::firstOrCreate(
            ['name' => 'Sprint Q4 2026 — Parallel Swarm & Real-Time Collaboration', 'project_id' => $project->id],
            [
                'workspace_id' => $workspaceId,
                'goal' => 'Chạy song song nhiều Agent trên Git Worktree độc lập, đồng bộ WebSockets thời gian thực qua Laravel Reverb.',
                'start_date' => Carbon::parse('2026-10-01')->toDateString(),
                'end_date' => Carbon::parse('2026-12-31')->toDateString(),
                'status' => 'future',
            ]
        );

        $sprintQ1 = Sprint::firstOrCreate(
            ['name' => 'Sprint Q1 2027 — Intelligence, Ecosystem & Marketplaces', 'project_id' => $project->id],
            [
                'workspace_id' => $workspaceId,
                'goal' => 'Kho mẫu Workflow Template, MCP Cloud Sync, Voice-to-Task tiếng Việt và Docker Sandbox an toàn.',
                'start_date' => Carbon::parse('2027-01-01')->toDateString(),
                'end_date' => Carbon::parse('2027-03-31')->toDateString(),
                'status' => 'future',
            ]
        );

        // 3. Define 6 Strategic Epics
        $epicsData = [
            [
                'issue_key' => 'EPIC-01',
                'title' => 'Quick Capture & Smart Task Entry (Thu thập việc nhanh & Nhập liệu thông minh)',
                'description' => 'Trụ cột 1 (Desktop Simple): Giúp người dùng ghi lại việc cần làm trong < 3s qua phím tắt toàn cục, bóc tách ngày giờ tự nhiên tiếng Việt và kéo thả sắp xếp.',
                'category' => 'desktop',
                'priority' => 'urgent',
                'status' => 'in_progress',
                'sprint_id' => $sprintQ3->id,
            ],
            [
                'issue_key' => 'EPIC-02',
                'title' => 'Daily Focus, Reminders & Habit Loops (Tập trung hàng ngày & Nhắc việc)',
                'description' => 'Trụ cột 1 (Desktop Simple): Nhắc việc toast Windows, tóm tắt đầu ngày Daily Briefing, đồng hồ Pomodoro kèm âm thanh thư giãn và việc lặp lại định kỳ.',
                'category' => 'desktop',
                'priority' => 'high',
                'status' => 'todo',
                'sprint_id' => $sprintQ3->id,
            ],
            [
                'issue_key' => 'EPIC-03',
                'title' => 'Multi-Agent Parallel Orchestration & Swarm (Điều phối Agent Đa luồng)',
                'description' => 'Trụ cột 2 (Desktop Dev): Giám sát và điều phối 3-5 Agent AI chạy song song trên các Git Worktree độc lập theo các vai trò Architect, Coder, Tester.',
                'category' => 'ai',
                'priority' => 'urgent',
                'status' => 'todo',
                'sprint_id' => $sprintQ4->id,
            ],
            [
                'issue_key' => 'EPIC-04',
                'title' => 'Evidence-Driven QA & Git Automation (Tự động hóa Kiểm thử & Git)',
                'description' => 'Trụ cột 2 (Desktop Dev): Tự động tạo Conventional Commits & GitHub PR, kiểm tra tự động từng tiêu chí Acceptance Criteria và bảo vệ sandbox Docker.',
                'category' => 'ai',
                'priority' => 'high',
                'status' => 'todo',
                'sprint_id' => $sprintQ4->id,
            ],
            [
                'issue_key' => 'EPIC-05',
                'title' => 'Agile Workspaces, Kanban & Real-time Collaboration (Làm việc nhóm Thời gian thực)',
                'description' => 'Trụ cột 3 (Web Hub SaaS): Bảng Kanban kéo thả mượt mà, đồng bộ WebSockets thời gian thực qua Laravel Reverb, phân quyền tổ chức RBAC và bình luận @mentions.',
                'category' => 'cloud',
                'priority' => 'urgent',
                'status' => 'todo',
                'sprint_id' => $sprintQ3->id,
            ],
            [
                'issue_key' => 'EPIC-06',
                'title' => 'Ecosystem, Templates & Omnichannel Notifications (Hệ sinh thái & Tích hợp)',
                'description' => 'Trụ cột 3 (Web Hub SaaS): Bắn thông báo Slack/Telegram/Discord/Zalo, kho mẫu quy trình công việc Template Marketplace và cổng bình chọn tính năng công khai.',
                'category' => 'cloud',
                'priority' => 'high',
                'status' => 'todo',
                'sprint_id' => $sprintQ1->id,
            ],
        ];

        $epicMap = [];
        foreach ($epicsData as $index => $epic) {
            $epicModel = Task::where('project_id', $project->id)
                ->where(function ($q) use ($epic) {
                    $q->where('title', 'like', "%{$epic['issue_key']}%")
                      ->orWhere('title', $epic['title'])
                      ->orWhere('issue_key', $epic['issue_key']);
                })->first();

            if (!$epicModel) {
                $count = Task::where('project_id', $project->id)->count() + 1;
                $issueKey = ($project->key ?: 'TH') . '-' . $count;
                $epicModel = new Task([
                    'project_id' => $project->id,
                    'issue_key' => $issueKey,
                ]);
            }

            $epicModel->fill([
                'workspace_id' => $workspaceId,
                'title' => $epic['title'],
                'description' => $epic['description'],
                'issue_type' => 'epic',
                'category' => $epic['category'],
                'priority' => $epic['priority'],
                'status' => $epic['status'],
                'sprint_id' => $epic['sprint_id'],
                'sort_order' => $index + 1,
            ]);
            $epicModel->save();
            $epicMap[$epic['issue_key']] = $epicModel->id;
        }

        // 4. Define 24 Strategic Features (Tasks & Stories)
        $features = [
            // EPIC-01 (Desktop Simple: Quick Capture)
            [
                'issue_key' => 'THUB-01',
                'epic_key' => 'EPIC-01',
                'title' => 'Global Quick-Add Overlay Bar (Thanh nhập việc nhanh toàn cục)',
                'description' => 'Nhấn tổ hợp phím tắt toàn cục Ctrl + Alt + Space từ bất kỳ cửa sổ nào trên Windows để mở ngay một thanh input nổi thanh mảnh giữa màn hình, cho phép gõ việc và bấm Enter lưu ngay vào danh sách mà không cần chuyển app.',
                'priority' => 'urgent', // P0
                'story_points' => 3,
                'category' => 'desktop',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Phím tắt Ctrl+Alt+Space mở thanh overlay trong < 100ms\n- [ ] Gõ Enter lưu việc tức thì và tự động đóng/ẩn thanh\n- [ ] Hỗ trợ phím Esc để hủy bỏ",
            ],
            [
                'issue_key' => 'THUB-02',
                'epic_key' => 'EPIC-01',
                'title' => 'Vietnamese Natural Language Date Parsing (Bóc tách ngày giờ tự nhiên tiếng Việt)',
                'description' => 'Tự động nhận diện và trích xuất ngày giờ từ câu văn gõ tiếng Việt tự nhiên (VD: "họp phòng ban chiều mai 3h", "nộp báo cáo thứ 6 tuần sau"). Tự động gán vào hạn chót due_date và loại bỏ cụm từ thời gian khỏi tiêu đề công việc.',
                'priority' => 'urgent', // P0
                'story_points' => 5,
                'category' => 'desktop',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Nhận diện chính xác 'hôm nay', 'ngày mai', 'thứ X tuần sau'\n- [ ] Bóc tách giờ cụ thể (VD: 3h chiều -> 15:00)\n- [ ] Tự động gán due_date chính xác theo múi giờ địa phương",
            ],
            [
                'issue_key' => 'THUB-03',
                'epic_key' => 'EPIC-01',
                'title' => 'Voice-to-Task Quick Dictation (Nhập việc bằng giọng nói tiếng Việt)',
                'description' => 'Nút micro thu âm nhanh trên thanh Quick Add sử dụng Web Speech API hoặc mô hình Whisper cục bộ, chuyển lời nói thành tiêu đề và tự động phân tách các ý phụ thành danh sách checklist bước con.',
                'priority' => 'medium', // P1
                'story_points' => 5,
                'category' => 'desktop',
                'sprint_id' => $sprintQ1->id,
                'acceptance_criteria' => "- [ ] Thu âm và nhận diện tiếng Việt chính xác > 90%\n- [ ] Tự động ngắt đoạn thành các bước con khi nói từ khóa 'bước tiếp theo'\n- [ ] Có hiệu ứng sóng âm hoạt họa khi thu âm",
            ],
            [
                'issue_key' => 'THUB-04',
                'epic_key' => 'EPIC-01',
                'title' => 'Drag-and-Drop Reordering (Kéo thả sắp xếp thứ tự công việc & bước con)',
                'description' => 'Hỗ trợ kéo thả trực quan các thẻ công việc trong danh sách và các dòng bước con trong drawer chi tiết để sắp xếp thứ tự ưu tiên bằng thao tác chuột tự nhiên.',
                'priority' => 'medium', // P1
                'story_points' => 3,
                'category' => 'desktop',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Kéo thả mượt mà với hiệu ứng bóng mờ chỉ vị trí thả\n- [ ] Cập nhật trường sort_order và lưu cache tức thì\n- [ ] Đồng bộ thứ tự mới lên server",
            ],

            // EPIC-02 (Desktop Simple: Focus & Reminders)
            [
                'issue_key' => 'THUB-05',
                'epic_key' => 'EPIC-02',
                'title' => 'Native Windows Toast Reminders & Daily Briefing (Nhắc việc Windows & Tóm tắt ngày)',
                'description' => 'Gửi thông báo Windows toast bản địa khi công việc sắp đến hạn hoặc quá hạn. Tích hợp popup Daily Briefing xuất hiện lúc 9:00 sáng tóm tắt 3 công việc quan trọng nhất cần giải quyết trong ngày.',
                'priority' => 'urgent', // P0
                'story_points' => 5,
                'category' => 'desktop',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Bắn thông báo native toast chuẩn Windows 10/11\n- [ ] Click vào thông báo mở thẳng drawer công việc\n- [ ] Cho phép tùy chỉnh bật/tắt và chọn giờ nhận Daily Briefing",
            ],
            [
                'issue_key' => 'THUB-06',
                'epic_key' => 'EPIC-02',
                'title' => 'Focus Soundscapes & Pomodoro Companion (Đồng hồ Pomodoro & Âm thanh thư giãn)',
                'description' => 'Bộ đếm thời gian tập trung Pomodoro chuẩn 25 phút làm việc / 5 phút nghỉ ngơi, tích hợp 4 bộ âm thanh nền tĩnh tâm (tiếng mưa rơi, quán cà phê lofi, sóng biển, tiếng rừng thông) kèm mascot cổ vũ.',
                'priority' => 'medium', // P1
                'story_points' => 3,
                'category' => 'desktop',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Bộ đếm ngược có chuông báo hết giờ\n- [ ] Tích hợp trình phát âm thanh vòng lặp không gián đoạn\n- [ ] Thống kê số chu kỳ Pomodoro hoàn thành trong ngày",
            ],
            [
                'issue_key' => 'THUB-07',
                'epic_key' => 'EPIC-02',
                'title' => 'Recurring Tasks Engine (Hệ thống công việc lặp lại định kỳ)',
                'description' => 'Hỗ trợ tạo công việc lặp lại theo chu kỳ: hàng ngày, các ngày trong tuần (T2-T6), hàng tuần vào ngày cụ thể, hoặc hàng tháng. Khi tick hoàn thành việc hiện tại, tự động tạo mới việc của kỳ tiếp theo.',
                'priority' => 'medium', // P1
                'story_points' => 5,
                'category' => 'desktop',
                'sprint_id' => $sprintQ4->id,
                'acceptance_criteria' => "- [ ] Chọn chu kỳ lặp lại trong drawer chi tiết\n- [ ] Khi tick hoàn thành task, task mới xuất hiện với due_date kế tiếp\n- [ ] Không làm mất lịch sử các task đã hoàn thành trước đó",
            ],
            [
                'issue_key' => 'THUB-08',
                'epic_key' => 'EPIC-02',
                'title' => '2-Way Calendar Sync (Đồng bộ lịch 2 chiều Google Calendar & .ics)',
                'description' => 'Cung cấp URL lịch iCal cá nhân để nhúng vào Apple Calendar/Outlook và tích hợp Google Calendar API 2 chiều để tự động phản ánh thay đổi hạn chót qua lại.',
                'priority' => 'low', // P2
                'story_points' => 5,
                'category' => 'desktop',
                'sprint_id' => $sprintQ1->id,
                'acceptance_criteria' => "- [ ] Tạo link subscription .ics bảo mật cho từng user\n- [ ] Hỗ trợ xác thực OAuth Google Calendar\n- [ ] Thay đổi ngày trên Google Calendar tự động cập nhật task",
            ],

            // EPIC-03 (Desktop Dev: Multi-Agent Parallel Swarm)
            [
                'issue_key' => 'THUB-09',
                'epic_key' => 'EPIC-03',
                'title' => 'Isolated Git Worktree Parallel Runner (Chạy song song Agent trên Git Worktree)',
                'description' => 'Cơ chế tự động tạo thư mục Git Worktree và nhánh riêng cho mỗi tác tử AI, cho phép lập trình viên chạy song song 3 task khác nhau cùng lúc trên cùng một repository mà không xung đột mã nguồn.',
                'priority' => 'urgent', // P0
                'story_points' => 8,
                'category' => 'ai',
                'sprint_id' => $sprintQ4->id,
                'acceptance_criteria' => "- [ ] Tạo nhánh git riêng dạng `feat/THUB-XX` trên worktree cô lập\n- [ ] Độc lập biến môi trường và tiến trình biên dịch\n- [ ] Tự động gỡ bỏ worktree an toàn sau khi merge hoặc hủy",
            ],
            [
                'issue_key' => 'THUB-10',
                'epic_key' => 'EPIC-03',
                'title' => 'Agent Roles Pipeline: Spec → Code → Test (Kịch bản phân vai tác tử)',
                'description' => 'Quy trình cộng tác 3 vai trò tự động: Architect Agent phân tích issue và sinh tài liệu đặc tả -> Coder Agent lập trình mã nguồn -> QA Agent chạy test tự động và đánh giá chất lượng.',
                'priority' => 'urgent', // P0
                'story_points' => 8,
                'category' => 'ai',
                'sprint_id' => $sprintQ4->id,
                'acceptance_criteria' => "- [ ] Chuyển giao ngữ cảnh (context artifacts) tự động giữa các bước\n- [ ] Có nút phê duyệt (Approval Gate) giữa giai đoạn Spec và Code\n- [ ] Hiển thị tiến trình trực quan trên FlowStepper stepper 4 giai đoạn",
            ],
            [
                'issue_key' => 'THUB-11',
                'epic_key' => 'EPIC-03',
                'title' => 'Extended Agent CLI Runners: Codex, Cursor, Copilot (Mở rộng bộ chạy Agent CLI)',
                'description' => 'Bổ sung trình kết nối và stream output chuẩn hóa cho OpenAI Codex CLI, Cursor Agent CLI và GitHub Copilot Workspace CLI ngoài Antigravity và Claude Code hiện có.',
                'priority' => 'medium', // P1
                'story_points' => 5,
                'category' => 'ai',
                'sprint_id' => $sprintQ4->id,
                'acceptance_criteria' => "- [ ] Tự động phát hiện CLI đã cài trong hệ điều hành\n- [ ] Chuẩn hóa telemetry tokens và output stream về chung 1 format\n- [ ] Cho phép chuyển đổi nhanh provider trên giao diện",
            ],
            [
                'issue_key' => 'THUB-12',
                'epic_key' => 'EPIC-03',
                'title' => 'Auto-Healing Loop & Interactive Terminal Takeover (Tự gỡ kẹt vòng lặp & Can thiệp tay)',
                'description' => 'Thuật toán chẩn đoán phát hiện khi Agent bị kẹt trong vòng lặp sửa lỗi lặp đi lặp lại (> 3 lần cùng 1 lỗi biên dịch) để tự động dừng và mở terminal PTY tương tác cho kỹ sư gõ lệnh can thiệp.',
                'priority' => 'medium', // P1
                'story_points' => 5,
                'category' => 'ai',
                'sprint_id' => $sprintQ4->id,
                'acceptance_criteria' => "- [ ] Nhận diện mẫu lặp log lặp lại chính xác trong vòng 3 chu kỳ\n- [ ] Tạm dừng an toàn tiến trình agent mà không mất ngữ cảnh\n- [ ] Cho phép dev gõ lệnh trực tiếp trong terminal nhúng",
            ],

            // EPIC-04 (Desktop Dev: Evidence-Driven QA & Git)
            [
                'issue_key' => 'THUB-13',
                'epic_key' => 'EPIC-04',
                'title' => 'Automated Pull Request & Conventional Commits (Tự động commit & Mở GitHub PR)',
                'description' => 'Sau khi Agent hoàn thành công việc và vượt qua kiểm thử, hệ thống tự động gom commit theo chuẩn Conventional Commits (feat, fix, docs), đẩy lên remote và tạo Pull Request kèm bảng bằng chứng nghiệm thu.',
                'priority' => 'urgent', // P0
                'story_points' => 5,
                'category' => 'ai',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Sinh commit message chuẩn xác dựa trên git diff\n- [ ] Mở PR trên GitHub API kèm Markdown bằng chứng (Test Pass Rate, Diff)\n- [ ] Đính kèm liên kết ngược về Task Hub Issue",
            ],
            [
                'issue_key' => 'THUB-14',
                'epic_key' => 'EPIC-04',
                'title' => 'Visual Acceptance Criteria Auto-Verifier (Tự động kiểm chứng tiêu chí nghiệm thu)',
                'description' => 'Trình phân tích đối chiếu từng dòng tiêu chí Acceptance Criteria dạng checklist - [ ] và chạy lệnh test tương ứng để tự động tích xanh - [x] khi code đáp ứng đầy đủ yêu cầu.',
                'priority' => 'medium', // P1
                'story_points' => 5,
                'category' => 'ai',
                'sprint_id' => $sprintQ4->id,
                'acceptance_criteria' => "- [ ] Bóc tách danh sách AC từ mô tả công việc\n- [ ] Chạy lệnh kiểm thử xác nhận từng tiêu chí\n- [ ] Đánh dấu hoàn thành tự động trên giao diện kèm bằng chứng log",
            ],
            [
                'issue_key' => 'THUB-15',
                'epic_key' => 'EPIC-04',
                'title' => 'Local Semantic Vector Codebase Search / RAG (Tìm kiếm ngữ nghĩa mã nguồn cục bộ)',
                'description' => 'Trình đánh chỉ mục vector mã nguồn cục bộ (sử dụng SQLite VSS hoặc LanceDB), cho phép Agent tra cứu nhanh các hàm, component và luồng xử lý liên quan trong dự án lớn trong < 200ms.',
                'priority' => 'medium', // P1
                'story_points' => 8,
                'category' => 'ai',
                'sprint_id' => $sprintQ1->id,
                'acceptance_criteria' => "- [ ] Đánh chỉ mục cục bộ không gửi code ra bên ngoài\n- [ ] Tìm kiếm ngữ nghĩa trả về top đoạn code liên quan nhất\n- [ ] Cập nhật chỉ mục gia tăng khi file thay đổi",
            ],
            [
                'issue_key' => 'THUB-16',
                'epic_key' => 'EPIC-04',
                'title' => 'Docker Sandbox Safe Runner (Môi trường thực thi cô lập an toàn)',
                'description' => 'Chạy toàn bộ lệnh terminal và mã nguồn do AI Agent sinh ra bên trong Docker container cô lập, bảo vệ máy tính của lập trình viên khỏi các lệnh nguy hiểm như xóa nhầm file hoặc rò rỉ dữ liệu.',
                'priority' => 'low', // P2
                'story_points' => 5,
                'category' => 'ai',
                'sprint_id' => $sprintQ1->id,
                'acceptance_criteria' => "- [ ] Khởi chạy nhanh container dựa trên cấu hình Dockerfile của dự án\n- [ ] Giới hạn CPU/RAM và chặn truy cập thư mục ngoài workspace\n- [ ] Xóa sạch container sau khi phiên chạy kết thúc",
            ],

            // EPIC-05 (Web Hub SaaS: Real-time Team Collaboration)
            [
                'issue_key' => 'THUB-17',
                'epic_key' => 'EPIC-05',
                'title' => 'Interactive Drag-and-Drop Kanban Board (Bảng Kanban kéo thả trực quan)',
                'description' => 'Giao diện bảng Kanban thời gian thực với các cột Backlog, To Do, In Progress, Review, Done; hỗ trợ kéo thả thẻ mượt mà, phân loại thẻ theo màu sắc dự án và bộ lọc đa chiều.',
                'priority' => 'urgent', // P0
                'story_points' => 5,
                'category' => 'cloud',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Kéo thả thẻ mượt mà giữa các cột với animation tự nhiên\n- [ ] Tự động cập nhật status của task trong database\n- [ ] Bộ lọc tức thời theo Sprint, Priority, Assignee và Tags",
            ],
            [
                'issue_key' => 'THUB-18',
                'epic_key' => 'EPIC-05',
                'title' => 'Real-time Multi-User Sync via Laravel Reverb (Đồng bộ đa người dùng thời gian thực)',
                'description' => 'Tích hợp Laravel Reverb WebSockets để phản ánh tức thì mọi thay đổi về công việc, trạng thái, bình luận và hiển thị avatar của các thành viên đang cùng xem hoặc sửa một task.',
                'priority' => 'urgent', // P0
                'story_points' => 8,
                'category' => 'cloud',
                'sprint_id' => $sprintQ4->id,
                'acceptance_criteria' => "- [ ] Độ trễ phát tán sự kiện < 150ms tới toàn bộ client đang mở\n- [ ] Hiển thị avatar presence của những ai đang xem cùng 1 task\n- [ ] Chống ghi đè xung đột (optimistic locking alert)",
            ],
            [
                'issue_key' => 'THUB-19',
                'epic_key' => 'EPIC-05',
                'title' => 'Multi-tenant Workspaces & Role-Based Access Control (Không gian làm việc & Phân quyền RBAC)',
                'description' => 'Hệ thống cho phép người dùng tham gia nhiều Workspace (công ty, nhóm nghiên cứu, dự án cá nhân). Hỗ trợ phân quyền chặt chẽ các vai trò: Owner, Admin, Member, Client / Viewer.',
                'priority' => 'medium', // P1
                'story_points' => 5,
                'category' => 'cloud',
                'sprint_id' => $sprintQ4->id,
                'acceptance_criteria' => "- [ ] Chuyển đổi nhanh giữa các Workspace trên thanh điều hướng\n- [ ] Phân quyền xem và sửa dự án/task theo vai trò\n- [ ] Bảo đảm cô lập dữ liệu tuyệt đối giữa các Workspace",
            ],
            [
                'issue_key' => 'THUB-20',
                'epic_key' => 'EPIC-05',
                'title' => 'Activity Stream, Markdown Comments & @Mentions (Nhật ký hoạt động & Bình luận @)',
                'description' => 'Khung thảo luận cho từng công việc hỗ trợ cú pháp Markdown phong phú, dán ảnh chụp màn hình, gắn thẻ tên đồng đội @username kèm theo dòng nhật ký ghi lại toàn bộ lịch sử chỉnh sửa.',
                'priority' => 'medium', // P1
                'story_points' => 3,
                'category' => 'cloud',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Trình soạn thảo bình luận hỗ trợ Markdown và dán ảnh clipboard\n- [ ] Gõ @ hiển thị danh sách gợi ý thành viên trong Workspace\n- [ ] Gửi thông báo trong app và email cho người được nhắc tên",
            ],

            // EPIC-06 (Web Hub SaaS: Ecosystem & Omnichannel)
            [
                'issue_key' => 'THUB-21',
                'epic_key' => 'EPIC-06',
                'title' => 'Omnichannel Webhook & Notification Hub (Trung tâm thông báo đa kênh Slack, Telegram, Discord, Zalo)',
                'description' => 'Hệ thống điều phối thông báo đa kênh: tự động gửi tin nhắn dạng Card đẹp mắt về kênh Slack, Discord, bot Telegram hoặc Zalo khi có task mới được giao, task trễ hạn hoặc khi Agent cần người duyệt.',
                'priority' => 'urgent', // P0
                'story_points' => 5,
                'category' => 'cloud',
                'sprint_id' => $sprintQ3->id,
                'acceptance_criteria' => "- [ ] Cấu hình webhook linh hoạt cho từng kênh\n- [ ] Gửi thẻ tin nhắn phong phú với các nút bấm Approve / View Task\n- [ ] Cho phép lọc loại sự kiện muốn nhận thông báo",
            ],
            [
                'issue_key' => 'THUB-22',
                'epic_key' => 'EPIC-06',
                'title' => 'Project Workflow Template Marketplace (Chợ mẫu quy trình dự án khởi tạo 1-click)',
                'description' => 'Thư viện các quy trình dự án được chuẩn hóa sẵn (Scrum Software Sprint, Content Marketing Campaign, Tuyển dụng nhân sự, Fullstack AI Workflow) cho phép người dùng tạo ngay dự án hoàn chỉnh.',
                'priority' => 'medium', // P1
                'story_points' => 5,
                'category' => 'cloud',
                'sprint_id' => $sprintQ1->id,
                'acceptance_criteria' => "- [ ] Xem trước cấu trúc task và milestone trước khi kích hoạt\n- [ ] Tạo dự án mới kèm đầy đủ task và checklist chỉ bằng 1 click\n- [ ] Cho phép người dùng lưu dự án hiện tại thành template riêng",
            ],
            [
                'issue_key' => 'THUB-23',
                'epic_key' => 'EPIC-06',
                'title' => 'Public Roadmap & Customer Feature Voting Portal (Cổng bình chọn tính năng công khai)',
                'description' => 'Trang Roadmap công khai cho phép khách hàng và người dùng cuối xem kế hoạch phát triển, đóng góp ý kiến và bình chọn tính năng. Tính năng đạt đủ số vote sẽ tự động được chuyển vào Backlog nội bộ.',
                'priority' => 'medium', // P1
                'story_points' => 5,
                'category' => 'cloud',
                'sprint_id' => $sprintQ1->id,
                'acceptance_criteria' => "- [ ] Trang công khai có giao diện hiện đại với danh sách tính năng theo cột\n- [ ] Người dùng có thể bấm Upvote và để lại bình luận góp ý\n- [ ] Tự động đồng bộ số vote và chuyển trạng thái sang In Backlog",
            ],
            [
                'issue_key' => 'THUB-24',
                'epic_key' => 'EPIC-06',
                'title' => 'Cloud MCP Gateway & Tool Registry Sync (Đồng bộ danh mục công cụ MCP trên Cloud)',
                'description' => 'Cổng quản lý và đồng bộ danh mục công cụ Model Context Protocol (MCP) trên Cloud. Giúp các kỹ sư cấu hình công cụ MCP 1 lần trên Web và tự động đồng bộ xuống tất cả máy tính desktop.',
                'priority' => 'low', // P2
                'story_points' => 5,
                'category' => 'cloud',
                'sprint_id' => $sprintQ1->id,
                'acceptance_criteria' => "- [ ] Quản lý danh sách MCP Server và API keys bảo mật trên Cloud\n- [ ] Desktop Companion tự động tải cấu hình MCP khi đăng nhập\n- [ ] Kiểm tra ping trạng thái hoạt động của từng công cụ MCP",
            ],
        ];

        foreach ($features as $index => $item) {
            $taskModel = Task::where('project_id', $project->id)
                ->where(function ($q) use ($item) {
                    $q->where('title', $item['title'])
                      ->orWhere('issue_key', $item['issue_key']);
                })->first();

            if (!$taskModel) {
                $count = Task::where('project_id', $project->id)->count() + 1;
                $issueKey = ($project->key ?: 'TH') . '-' . $count;
                $taskModel = new Task([
                    'project_id' => $project->id,
                    'issue_key' => $issueKey,
                ]);
            }

            $taskModel->fill([
                'workspace_id' => $workspaceId,
                'title' => $item['title'],
                'description' => $item['description'],
                'issue_type' => 'story',
                'category' => $item['category'],
                'priority' => $item['priority'],
                'status' => 'todo',
                'story_points' => $item['story_points'],
                'sprint_id' => $item['sprint_id'],
                'epic_id' => $epicMap[$item['epic_key']] ?? null,
                'due_date' => $item['due_date'] ?? null,
                'acceptance_criteria' => $item['acceptance_criteria'],
                'sort_order' => $index + 1,
            ]);
            $taskModel->save();
        }

        $this->command?->info("Successfully seeded Task Hub Strategic Roadmap (Project: {$project->title}, 6 Epics, 24 Features).");
    }
}
