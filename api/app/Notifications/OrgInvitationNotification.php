<?php

namespace App\Notifications;

use App\Models\OrgInvitation;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Invites someone to join a carrier or shipper company. Each person signs up with their own login. */
class OrgInvitationNotification extends Notification
{
    public function __construct(
        private OrgInvitation $invitation,
        private string $companyName,
        private string $invitedBy,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public static function url(OrgInvitation $invitation): string
    {
        return rtrim((string) config('app.frontend_url'), '/') . '/register?invite=' . $invitation->token;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $role = \App\Services\PersonChecks::ROLE_LABELS[$this->invitation->role] ?? $this->invitation->role;

        return (new MailMessage)
            ->subject("Join {$this->companyName} on Shipmater")
            ->greeting('Hello,')
            ->line("{$this->invitedBy} invited you to join {$this->companyName} on Shipmater as {$role}.")
            ->line('Create your own login to accept. If you already have a Shipmater account, sign in from the same link.')
            ->action('Accept invitation', self::url($this->invitation))
            ->line('This invitation expires in 7 days.');
    }
}
