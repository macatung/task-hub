<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WeeklyTaskReportMail extends Mailable
{
    use Queueable, SerializesModels;

    public array $reportData;
    public string $customSubject;

    /**
     * Create a new message instance.
     */
    public function __construct(array $reportData, ?string $customSubject = null)
    {
        $this->reportData = $reportData;
        $this->customSubject = $customSubject ?: 'Weekly Project & Sprint Progress Report — ' . ($reportData['report_period']['generated_at'] ?? date('d M Y'));
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->customSubject . ' [Week ' . ($this->reportData['report_period']['week_number'] ?? '') . ']',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.weekly_task_report',
            with: [
                'data' => $this->reportData,
                'period' => $this->reportData['report_period'],
                'scope' => $this->reportData['scope'] ?? [],
                'kpis' => $this->reportData['kpis'],
                'sprint' => $this->reportData['sprint_metrics'],
                'completedTasks' => $this->reportData['completed_tasks'],
                'upcomingTasks' => $this->reportData['upcoming_tasks'],
                'warningTasks' => $this->reportData['warning_tasks'],
            ]
        );
    }

    /**
     * Get the attachments for the message.
     */
    public function attachments(): array
    {
        return [];
    }
}
