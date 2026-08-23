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
        $mindfulProject = Project::firstOrCreate(
            ['slug' => 'mindfulness-desktop-tools'],
            [
                'key' => 'MIND',
                'title' => 'Mindfulness Desktop Tools',
                'tagline' => 'Focus, breathing, and mindful productivity tools',
                'description' => 'Desktop tools for mindful focus and healthy work sessions.',
                'category' => 'productivity',
                'tags' => ['mindfulness', 'desktop', 'productivity'],
                'color' => '#8b5cf6',
            ]
        );

        // 1. Create Sprints
        $sprint1 = Sprint::firstOrCreate(
            ['name' => 'Sprint 1 — Core Intelligence & Dispatching'],
            [
                'project_id' => $omniProject?->id,
                'goal' => 'Complete multi-agent routing workflow and resolve customer escalations automatically in under 1.2s.',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'status' => 'active',
            ]
        );

        $sprint2 = Sprint::firstOrCreate(
            ['name' => 'Sprint 2 — Transcoding Pipeline & Performance'],
            [
                'project_id' => $streamProject?->id,
                'goal' => 'Optimize multi-threaded FFmpeg pipeline and CDN edge caching.',
                'start_date' => Carbon::today()->addDays(12)->toDateString(),
                'end_date' => Carbon::today()->addDays(26)->toDateString(),
                'status' => 'future',
            ]
        );

        $mindfulSprint = Sprint::firstOrCreate(
            ['name' => 'Mindful Productivity Sprint'],
            [
                'project_id' => $mindfulProject->id,
                'goal' => 'Build focused and sustainable desktop work habits.',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'status' => 'active',
            ]
        );

        // 2. Create Epics
        $epicOmni = Task::firstOrCreate(
            ['title' => 'EPIC: Distributed Autonomous Multi-Agent AI Architecture'],
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-1',
                'issue_type' => 'epic',
                'description' => "### Epic Goal\nBuild a distributed multi-agent network capable of autonomously resolving tickets, processing refunds, and reconciling cross-channel telemetry.",
                'status' => 'in_progress',
                'priority' => 'urgent',
                'category' => 'ai_agent',
                'story_points' => 21,
                'start_date' => $startDate,
                'due_date' => Carbon::today()->addDays(30)->toDateString(),
            ]
        );

        $epicStream = Task::firstOrCreate(
            ['title' => 'EPIC: High-Throughput Adaptive Bitrate Video Transcoding Platform'],
            [
                'project_id' => $streamProject?->id,
                'issue_key' => 'STREAM-1',
                'issue_type' => 'epic',
                'description' => "### Epic Goal\nDeliver low-latency HLS/DASH streaming infrastructure capable of scaling to 100,000 CCU.",
                'status' => 'todo',
                'priority' => 'high',
                'category' => 'infra',
                'story_points' => 13,
                'start_date' => $startDate,
                'due_date' => Carbon::today()->addDays(45)->toDateString(),
            ]
        );

        $epicMindful = Task::firstOrCreate(
            ['title' => 'EPIC: Mindfulness & Vipassanā Focus Companion'],
            [
                'project_id' => $mindfulProject->id,
                'issue_key' => 'MCT-1',
                'issue_type' => 'epic',
                'description' => "### Epic Goal\nIntegrate 432Hz meditation timer, mindfulness bells, and Pāḷi glossary lookup.",
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
                'title' => 'Integrate Function Calling for Real-Time Order Status Lookup',
                'description' => "#### User Story\nAs a support engineer or customer, I want the AI agent to automatically execute database tool calls to inspect order status in real time.\n\n```json\n{\n  \"action\": \"lookup_order\",\n  \"order_id\": \"MCT-99218\"\n}\n```",
                'status' => 'in_progress',
                'priority' => 'urgent',
                'category' => 'ai_agent',
                'story_points' => 5,
                'estimated_pomodoros' => 4,
                'completed_pomodoros' => 2,
                'start_date' => $startDate,
                'due_date' => $today,
                'notes' => json_encode([
                    ['id' => 'st-1', 'text' => 'Design JSON tool definition schema for Gemini', 'done' => true],
                    ['id' => 'st-2', 'text' => 'Create ERP API controller with Bearer authentication', 'done' => true],
                    ['id' => 'st-3', 'text' => 'Handle fallback flow when order record is not found', 'done' => false],
                ]),
            ],
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-3',
                'issue_type' => 'task',
                'epic_id' => $epicOmni->id,
                'sprint_id' => $sprint1->id,
                'title' => 'Configure Redis Cluster Queue for 5,000 Concurrent Webhooks/sec',
                'description' => "Configure Redis Streams and Laravel Horizon workers to ingest high-volume incoming webhooks without bottlenecking.",
                'status' => 'todo',
                'priority' => 'high',
                'category' => 'infra',
                'story_points' => 8,
                'estimated_pomodoros' => 4,
                'completed_pomodoros' => 0,
                'start_date' => $today,
                'due_date' => Carbon::today()->addDays(2)->toDateString(),
                'notes' => json_encode([
                    ['id' => 'st-4', 'text' => 'Configure Horizon Dashboard and queue metrics', 'done' => false],
                    ['id' => 'st-5', 'text' => 'Run load benchmark tests using k6', 'done' => false],
                ]),
            ],
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-4',
                'issue_type' => 'bug',
                'epic_id' => $epicOmni->id,
                'sprint_id' => $sprint1->id,
                'title' => 'Fix Token Overflow Error When Conversation Context Exceeds 32k Tokens',
                'description' => "**Problem**: When conversation exceeds 50 turns, prompt overflows token limits resulting in HTTP 429 from Gemini API.\n**Solution**: Implement rolling window context summarization to condense previous dialogue turns.",
                'status' => 'review',
                'priority' => 'urgent',
                'category' => 'ai_agent',
                'story_points' => 3,
                'estimated_pomodoros' => 2,
                'completed_pomodoros' => 2,
                'start_date' => $startDate,
                'due_date' => $today,
                'notes' => json_encode([
                    ['id' => 'st-6', 'text' => 'Implement rolling context summarizer algorithm', 'done' => true],
                    ['id' => 'st-7', 'text' => 'Unit test with 64k token context payload', 'done' => true],
                ]),
            ],
            [
                'project_id' => $omniProject?->id,
                'issue_key' => 'OMNI-5',
                'issue_type' => 'story',
                'epic_id' => $epicOmni->id,
                'sprint_id' => null, // In Backlog
                'title' => 'Automated Customer Sentiment & Emotion Classification',
                'description' => "Detect customer frustration levels to trigger automated escalation protocols.",
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
                'title' => 'Deploy Hardware-Accelerated FFmpeg H.265 / AV1 on GPU Nodes',
                'description' => "Configure Nvidia NVENC acceleration for 4K 60fps low-latency transcoding.",
                'status' => 'todo',
                'priority' => 'high',
                'category' => 'infra',
                'story_points' => 8,
                'estimated_pomodoros' => 5,
                'completed_pomodoros' => 0,
                'due_date' => Carbon::today()->addDays(14)->toDateString(),
            ],
            [
                'project_id' => $mindfulProject->id,
                'issue_key' => 'MCT-2',
                'issue_type' => 'story',
                'epic_id' => $epicMindful->id,
                'sprint_id' => $mindfulSprint->id,
                'title' => 'Synchronize 432Hz Tibetan Singing Bowl Audio with Desktop Companion',
                'description' => "Play mindful interval bells every 30 minutes to prompt posture check and eye rest.",
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
