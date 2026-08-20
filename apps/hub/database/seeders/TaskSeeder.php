<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Task;
use App\Models\Project;
use App\Models\Sprint;
use Carbon\Carbon;

class TaskSeeder extends Seeder
{
    public function run(): void
    {
        $today = Carbon::today()->toDateString();
        $startDate = Carbon::today()->subDays(3)->toDateString();
        $endDate = Carbon::today()->addDays(11)->toDateString();

        // Get projects
        $omniProject = Project::where('slug', 'ai-agent-customer-service-ecosystem')->first();
        $streamProject = Project::where('slug', 'streaming-platform-transcoding')->first();
        $finProject = Project::where('slug', 'stock-valuation-financial-management')->first();

        // 1. Create Sprints
        $sprint1 = Sprint::firstOrCreate(
            ['name' => 'Sprint 1 — Core Intelligence & Dispatching'],
            [
                'project_id' => $omniProject?->id,
                'goal' => 'Hoàn thiện luồng định tuyến Multi-Agent và xử lý khiếu nại khách hàng tự động dưới 1.2s.',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'status' => 'active',
            ]
        );

        $sprint2 = Sprint::firstOrCreate(
            ['name' => 'Sprint 2 — Transcoding Pipeline & Performance'],
            [
                'project_id' => $streamProject?->id,
                'goal' => 'Tối ưu hóa pipeline FFmpeg đa luồng và CDN Edge Caching.',
                'start_date' => Carbon::today()->addDays(12)->toDateString(),
                'end_date' => Carbon::today()->addDays(26)->toDateString(),
                'status' => 'future',
            ]
        );

        // 2. Create Epics
        $epicOmni = Task::firstOrCreate(
            ['title' => 'EPIC: Kiến Trúc Multi-Agent AI Tự Trị Phân Tán'],
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-1',
                'issue_type' => 'epic',
                'description' => '### Mục tiêu Epic\nXây dựng mạng lưới Multi-Agent phân tán có khả năng tự trị giải quyết khiếu nại, hoàn tiền và đối soát dữ liệu đa kênh.',
                'status' => 'in_progress',
                'priority' => 'urgent',
                'category' => 'ai_agent',
                'story_points' => 21,
                'start_date' => $startDate,
                'due_date' => Carbon::today()->addDays(30)->toDateString(),
            ]
        );

        $epicStream = Task::firstOrCreate(
            ['title' => 'EPIC: Nền Tảng Chuyển Mã Video Tải Cao Adaptive Bitrate'],
            [
                'project_id' => $streamProject?->id,
                'issue_key' => 'STREAM-1',
                'issue_type' => 'epic',
                'description' => '### Mục tiêu Epic\nCung cấp dịch vụ phát sóng HLS/DASH độ trễ thấp với khả năng scale 100,000 CCU.',
                'status' => 'todo',
                'priority' => 'high',
                'category' => 'infra',
                'story_points' => 13,
                'start_date' => $startDate,
                'due_date' => Carbon::today()->addDays(45)->toDateString(),
            ]
        );

        $epicMindful = Task::firstOrCreate(
            ['title' => 'EPIC: Pháp Bảo & Không Gian Thiền Chánh Niệm Vipassanā'],
            [
                'project_id' => null,
                'issue_key' => 'MCT-1',
                'issue_type' => 'epic',
                'description' => '### Mục tiêu Epic\nTích hợp đồng hồ tọa thiền 432Hz, chuông chánh niệm và tra cứu từ điển Pāḷi.',
                'status' => 'done',
                'priority' => 'medium',
                'category' => 'mindful',
                'story_points' => 8,
                'start_date' => $startDate,
                'due_date' => $today,
            ]
        );

        // 3. Create Stories, Tasks, Bugs
        $tasksData = [
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-2',
                'issue_type' => 'story',
                'epic_id' => $epicOmni->id,
                'sprint_id' => $sprint1->id,
                'title' => 'Tích hợp Function Calling tra cứu trạng thái đơn hàng thời gian thực',
                'description' => "#### User Story\nLà nhân viên CSKH hoặc khách hàng, tôi muốn Agent có thể tự động gọi API cơ sở dữ liệu tra cứu đơn hàng để trả lời ngay lập tức.\n\n```json\n{\n  \"action\": \"lookup_order\",\n  \"order_id\": \"MCT-99218\"\n}\n```",
                'status' => 'in_progress',
                'priority' => 'urgent',
                'category' => 'ai_agent',
                'story_points' => 5,
                'estimated_pomodoros' => 4,
                'completed_pomodoros' => 2,
                'start_date' => $startDate,
                'due_date' => $today,
                'notes' => json_encode([
                    ['id' => 'st-1', 'text' => 'Thiết kế schema JSON tool definition cho Gemini', 'done' => true],
                    ['id' => 'st-2', 'text' => 'Tạo controller kết nối ERP API có xác thực Bearer', 'done' => true],
                    ['id' => 'st-3', 'text' => 'Xử lý fallback khi đơn hàng không tồn tại', 'done' => false],
                ]),
            ],
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-3',
                'issue_type' => 'task',
                'epic_id' => $epicOmni->id,
                'sprint_id' => $sprint1->id,
                'title' => 'Thiết lập Hàng Đợi Redis Cluster xử lý đồng thời 5,000 webhook/giây',
                'description' => "Cấu hình Redis Stream và Laravel Horizon workers để xử lý luồng webhook từ Telegram và Zalo mà không bị nghẽn.",
                'status' => 'todo',
                'priority' => 'high',
                'category' => 'infra',
                'story_points' => 8,
                'estimated_pomodoros' => 4,
                'completed_pomodoros' => 0,
                'start_date' => $today,
                'due_date' => Carbon::today()->addDays(2)->toDateString(),
                'notes' => json_encode([
                    ['id' => 'st-4', 'text' => 'Cấu hình Horizon Dashboard và metrics', 'done' => false],
                    ['id' => 'st-5', 'text' => 'Benchmark tải bằng k6', 'done' => false],
                ]),
            ],
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-4',
                'issue_type' => 'bug',
                'epic_id' => $epicOmni->id,
                'sprint_id' => $sprint1->id,
                'title' => 'Fix lỗi Token Overflow khi ngữ cảnh hội thoại vượt quá 32k tokens',
                'description' => "**Vấn đề**: Khi khách hàng trò chuyện dài > 50 lượt, prompt bị tràn token dẫn đến HTTP 429 từ Gemini API.\n**Giải pháp**: Áp dụng rolling window context summarization để tóm tắt các lượt hội thoại cũ.",
                'status' => 'review',
                'priority' => 'urgent',
                'category' => 'ai_agent',
                'story_points' => 3,
                'estimated_pomodoros' => 2,
                'completed_pomodoros' => 2,
                'start_date' => $startDate,
                'due_date' => $today,
                'notes' => json_encode([
                    ['id' => 'st-6', 'text' => 'Viết thuật toán context summarizer', 'done' => true],
                    ['id' => 'st-7', 'text' => 'Unit test với context 64k tokens', 'done' => true],
                ]),
            ],
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-5',
                'issue_type' => 'story',
                'epic_id' => $epicOmni->id,
                'sprint_id' => null, // In Backlog
                'title' => 'Tự động phân loại sắc thái cảm xúc khách hàng (Sentiment Analysis)',
                'description' => "Nhận diện độ tức giận của khách hàng để kích hoạt quy trình escalation khẩn cấp.",
                'status' => 'todo',
                'priority' => 'medium',
                'category' => 'ai_agent',
                'story_points' => 5,
                'estimated_pomodoros' => 3,
                'completed_pomodoros' => 0,
                'due_date' => Carbon::today()->addDays(7)->toDateString(),
            ],
            [
                'project_id' => $streamProject?->id,
                'issue_key' => 'STREAM-2',
                'issue_type' => 'task',
                'epic_id' => $epicStream->id,
                'sprint_id' => $sprint2->id,
                'title' => 'Triển khai FFmpeg H.265 / AV1 Hardware Acceleration trên GPU Node',
                'description' => "Cấu hình Nvidia NVENC để tăng tốc transcode 4K 60fps với độ trễ < 2s.",
                'status' => 'todo',
                'priority' => 'high',
                'category' => 'infra',
                'story_points' => 8,
                'estimated_pomodoros' => 5,
                'completed_pomodoros' => 0,
                'due_date' => Carbon::today()->addDays(14)->toDateString(),
            ],
            [
                'project_id' => null,
                'issue_key' => 'MCT-2',
                'issue_type' => 'story',
                'epic_id' => $epicMindful->id,
                'sprint_id' => $sprint1->id,
                'title' => 'Đồng bộ âm thanh chuông xoay Tây Tạng 432Hz với Desktop Companion',
                'description' => "Phát chuông chánh niệm định kỳ mỗi 30 phút để nhắc nhở người dùng giữ chánh niệm và nghỉ ngơi mắt.",
                'status' => 'done',
                'priority' => 'medium',
                'category' => 'mindful',
                'story_points' => 3,
                'estimated_pomodoros' => 2,
                'completed_pomodoros' => 2,
                'due_date' => $today,
                'completed_at' => Carbon::now(),
            ],
        ];

        foreach ($tasksData as $tData) {
            Task::updateOrCreate(
                ['issue_key' => $tData['issue_key']],
                $tData
            );
        }
    }
}