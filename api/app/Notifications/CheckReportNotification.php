<?php

namespace App\Notifications;

use App\Models\BackgroundCheck;
use App\Services\Background\CheckReports;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * A finished background check: the Shipmater summary PDF is attached. The provider's full consumer report is not
 * attached (it can't be taken back once emailed); the email links to Profile → Verification to download it after signing in.
 */
class CheckReportNotification extends Notification
{
    public function __construct(private BackgroundCheck $check) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $level  = $this->check->coversComplete() ? 'complete' : 'basic';
        $result = CheckReports::RESULT[$this->check->status] ?? $this->check->status;
        $url    = rtrim((string) config('app.frontend_url'), '/') . '/carrier/profile?tab=checks';

        return (new MailMessage)
            ->subject("Your {$level} background check: {$result}")
            ->greeting('Hello ' . (explode(' ', (string) $notifiable->name)[0] ?? '') . ',')
            ->line("Your {$level} background check is finished. Result: {$result}.")
            ->line('A summary is attached. Sign in to download the full report from Profile → Verification.')
            ->action('Open Verification', $url)
            ->line('The full report contains personal information, so it is only available after you sign in.')
            ->attachData(CheckReports::summaryPdf($this->check), CheckReports::filename($this->check, 'summary'), ['mime' => 'application/pdf']);
    }
}
