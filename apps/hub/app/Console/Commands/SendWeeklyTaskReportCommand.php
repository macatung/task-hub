<?php

namespace App\Console\Commands;

use App\Services\WeeklyTaskReportService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendWeeklyTaskReportCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'report:weekly-tasks {--email= : Gửi tới email chỉ định} {--force : Bỏ qua kiểm tra lịch và gửi ngay}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Tổng hợp và gửi email báo cáo tiến độ tuần cho sếp và ban quản lý';

    /**
     * Execute the console command.
     */
    public function handle(WeeklyTaskReportService $reportService): int
    {
        $settings = $reportService->getSettings();
        $isForce = $this->option('force');
        $customEmail = $this->option('email');

        if (!$isForce && empty($customEmail)) {
            if (empty($settings['is_enabled'])) {
                $this->info('Weekly Task Report is currently DISABLED in settings.');
                return self::SUCCESS;
            }

            // Check day of week
            $today = strtolower(Carbon::now()->englishDayOfWeek); // e.g. 'monday'
            $targetDay = strtolower($settings['day_of_week'] ?? 'monday');

            if ($today !== $targetDay) {
                $this->info("Today is {$today}, scheduled day is {$targetDay}. Skipping.");
                return self::SUCCESS;
            }
        }

        $this->info('Generating and sending weekly task report...');

        $result = $reportService->sendReport($customEmail);

        if ($result['success']) {
            $this->info($result['message']);
            $this->table(['Metric', 'Value'], [
                ['Completed Tasks', $result['kpis']['completed_tasks_count'] ?? 0],
                ['Completed Story Points', $result['kpis']['completed_story_points'] ?? 0],
                ['Sprint Progress', ($result['kpis']['sprint_progress_percent'] ?? 0) . '%'],
                ['Warning / Overdue Tasks', $result['kpis']['warning_tasks_count'] ?? 0],
            ]);
            return self::SUCCESS;
        } else {
            $this->error($result['message']);
            return self::FAILURE;
        }
    }
}
