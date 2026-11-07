<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A load update for a contact at a pickup or drop-off location (App\Services\ContactNotifier) */
class LoadUpdateNotification extends Notification
{
    public function __construct(private string $subject, private array $lines, private ?string $trackUrl) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->subject($this->subject)->greeting('Hello,');
        foreach ($this->lines as $line) $mail->line($line);
        if ($this->trackUrl) $mail->action('Track this load', $this->trackUrl);
        return $mail->line('You get these updates because you are a contact for this location. Your company can change them on Shipmater.');
    }
}
