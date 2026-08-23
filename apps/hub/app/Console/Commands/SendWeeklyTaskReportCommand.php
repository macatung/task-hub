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
    protected $signature = 'report:weekly-tasks {--email= : Send to specified email address} {--force : Bypass schedule check and dispatch immediately}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Compile and send weekly task and sprint progress reports to stakeholders';

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
