<?php

namespace Tests\Feature;

use App\Mail\WeeklyTaskReportMail;
use App\Models\Project;
use App\Models\SiteSetting;
use App\Models\Sprint;
use App\Models\Task;
use App\Services\WeeklyTaskReportService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class WeeklyTaskReportEmailTest extends TestCase
{
    use RefreshDatabase;

    public function test_get_and_save_report_settings_via_api()
    {
        // 1. Get default settings
        $response = $this->getJson('/api/tasks/report-settings');
        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'data' => [
                         'is_enabled' => false,
                         'day_of_week' => 'monday',
                         'send_time' => '08:00',
                         'selected_project_ids' => ['all'],
                     ],
                 ]);

        // 2. Save new settings with multiple projects
        $saveResponse = $this->postJson('/api/tasks/report-settings', [
            'is_enabled' => true,
            'recipients' => 'boss@company.com, manager@company.com',
            'day_of_week' => 'monday',
            'send_time' => '08:00',
            'report_title' => 'Weekly Executive Progress & Sprint Report',
            'selected_project_ids' => [1, 2],
            'include_upcoming' => true,
            'include_warnings' => true,
        ]);

        $saveResponse->assertStatus(200)
                     ->assertJson([
                         'success' => true,
                         'data' => [
                             'is_enabled' => true,
                             'recipients' => 'boss@company.com, manager@company.com',
                             'selected_project_ids' => [1, 2],
                         ],
                     ]);

        $savedRaw = SiteSetting::get('task_report_settings');
        $this->assertNotNull($savedRaw);
        $this->assertStringContainsString('boss@company.com', $savedRaw);
    }

    public function test_weekly_report_service_aggregates_english_kpis_and_filters_multi_projects()
    {
        $project1 = Project::create([
            'title' => 'Core Banking Platform',
            'tagline' => 'Next-gen enterprise banking system',
            'description' => 'Flagship enterprise banking transformation project',
            'slug' => 'core-banking-platform',
            'key' => 'BANK',
            'type' => 'work',
            'status' => 'active',
            'color' => '#2563eb',
        ]);

        $project2 = Project::create([
            'title' => 'AsiaStream Video Transcoder',
            'tagline' => 'High throughput transcoding pipeline',
            'description' => 'Distributed video processing cluster',
            'slug' => 'asiastream-video-transcoder',
            'key' => 'STREAM',
            'type' => 'work',
            'status' => 'active',
            'color' => '#7c3aed',
        ]);

        $sprint = Sprint::create([
            'name' => 'Sprint 1 - Foundation',
            'goal' => 'Core infrastructure & API pipelines',
            'status' => 'active',
            'start_date' => Carbon::now()->subDays(3)->toDateString(),
            'end_date' => Carbon::now()->addDays(11)->toDateString(),
        ]);

        // Task 1: Project 1 Done
        Task::create([
            'project_id' => $project1->id,
            'sprint_id' => $sprint->id,
            'issue_key' => 'BANK-1',
            'title' => 'Design High-Availability Database Schema',
            'status' => 'done',
            'priority' => 'high',
            'story_points' => 5,
            'estimated_pomodoros' => 4,
            'completed_pomodoros' => 4,
            'completed_at' => Carbon::now()->subDays(2),
        ]);

        // Task 2: Project 2 Done
        Task::create([
            'project_id' => $project2->id,
            'sprint_id' => $sprint->id,
            'issue_key' => 'STREAM-1',
            'title' => 'FFmpeg Distributed Encoder Cluster',
            'status' => 'done',
            'priority' => 'urgent',
            'story_points' => 8,
            'completed_at' => Carbon::now()->subDays(1),
        ]);

        // Task 3: Project 1 Overdue
        Task::create([
            'project_id' => $project1->id,
            'sprint_id' => $sprint->id,
            'issue_key' => 'BANK-3',
            'title' => 'API Security Compliance Documentation',
            'status' => 'todo',
            'priority' => 'medium',
            'story_points' => 3,
            'due_date' => Carbon::now()->subDays(1)->toDateString(),
        ]);

        $service = app(WeeklyTaskReportService::class);

        // 1. Report for All Projects
        $allData = $service->generateReportData(['all']);
        $this->assertEquals(2, $allData['kpis']['completed_tasks_count']);
        $this->assertEquals(13, $allData['kpis']['completed_story_points']); // 5 + 8
        $this->assertEquals(1, $allData['kpis']['warning_tasks_count']);
        $this->assertEquals('All Projects', $allData['scope']['selected_projects_label']);

        // 2. Report for only Project 1 (BANK)
        $p1Data = $service->generateReportData([$project1->id]);
        $this->assertEquals(1, $p1Data['kpis']['completed_tasks_count']);
        $this->assertEquals(5, $p1Data['kpis']['completed_story_points']);
        $this->assertEquals('Core Banking Platform', $p1Data['scope']['selected_projects_label']);

        // 3. Render English Blade template
        $mailable = new WeeklyTaskReportMail($allData, 'Weekly Project & Sprint Progress Report');
        $html = $mailable->render();

        $this->assertStringContainsString('Weekly Project & Sprint Progress Report', $html);
        $this->assertStringContainsString('Deliverables Completed This Week', $html);
        $this->assertStringContainsString('Design High-Availability Database Schema', $html);
        $this->assertStringContainsString('BANK-1', $html);
        $this->assertStringContainsString('5 pts', $html);
        $this->assertStringContainsString('STREAM-1', $html);
        $this->assertStringContainsString('8 pts', $html);
        $this->assertStringContainsString('Overdue by 1 day(s)', $html);
        $this->assertStringContainsString('All Projects', $html);

        // Crucial requirement: No pomodoro in executive boss report
        $this->assertStringNotContainsString('pomodoro', strtolower($html));
    }

    public function test_send_report_now_api_with_multi_projects()
    {
        Mail::fake();

        $response = $this->postJson('/api/tasks/send-report-now', [
            'email' => 'boss@corporation.com, lead@corporation.com',
            'project_ids' => [1, 2],
        ]);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                 ]);

        Mail::assertSent(WeeklyTaskReportMail::class, function ($mail) {
            return $mail->hasTo('boss@corporation.com') && $mail->hasTo('lead@corporation.com');
        });
    }

    public function test_artisan_command_sends_weekly_report()
    {
        Mail::fake();

        $this->artisan('report:weekly-tasks', ['--force' => true, '--email' => 'ceo@startup.vn'])
             ->assertExitCode(0);

        Mail::assertSent(WeeklyTaskReportMail::class, function ($mail) {
            return $mail->hasTo('ceo@startup.vn');
        });
    }
}
