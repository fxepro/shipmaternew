<?php

namespace App\Services;

use App\Models\ContactNotification;
use App\Models\FreightJob;
use App\Models\JobStop;
use App\Models\OrgContact;
use App\Notifications\LoadUpdateNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;

/**
 * Sends load updates to the contacts at a stop's location, by each contact's own settings (OrgContact::EVENTS).
 * A contact gets updates for their own location, or for every location of their company when they have none.
 * Every send, skip and failure is recorded in contact_notifications. Sending never breaks the action behind it.
 */
class ContactNotifier
{
    /** Addresses that never receive mail: demo and reserved domains, including their subdomains (x@store.example.com) */
    private const NO_MAIL = ['/[@.]demo\.com$/i', '/[@.]example\.(com|org|net)$/i', '/\.(test|example|invalid|localhost)$/i'];

    /** A carrier is booked: tell the contacts at every stop */
    public function booked(FreightJob $job): void
    {
        foreach ($job->stops()->whereNotNull('location_id')->get() as $stop) {
            $this->stop($stop, 'booked', $job);
        }
    }

    /** A stop changed: en_route, arrived, or completed (sent as done) */
    public function stopStatus(JobStop $stop, string $status): void
    {
        $event = ['en_route' => 'en_route', 'arrived' => 'arrived', 'completed' => 'done'][$status] ?? null;
        if ($event) $this->stop($stop, $event);
    }

    private function stop(JobStop $stop, string $event, ?FreightJob $job = null): void
    {
        try {
            if (!$stop->location_id) return;
            $job ??= $stop->freightJob;
            $location = $stop->location;
            if (!$location) return;

            $contacts = OrgContact::where('org_id', $location->org_id)
                ->where(fn ($q) => $q->whereNull('location_id')->orWhere('location_id', $location->id))
                ->get();

            [$subject, $lines] = $this->message($job, $stop, $location->name, $event);
            $track = $job->tracking_token ? rtrim((string) config('app.frontend_url'), '/') . '/track/' . $job->tracking_token : null;

            foreach ($contacts as $c) {
                foreach ($c->channelsFor($event) as $channel) {
                    $this->send($c, $channel, $job, $stop, $event, $subject, $lines, $track);
                }
            }
        } catch (\Throwable $e) {
            report($e);
        }
    }

    private function send(OrgContact $c, string $channel, FreightJob $job, JobStop $stop, string $event, string $subject, array $lines, ?string $track): void
    {
        $to = $channel === 'email' ? $c->email : ($c->mobile ?: null);
        $log = fn ($status, $detail = null) => ContactNotification::create([
            'contact_id' => $c->id, 'org_id' => $c->org_id, 'freight_job_id' => $job->id, 'stop_id' => $stop->id,
            'event' => $event, 'channel' => $channel, 'recipient' => $to, 'status' => $status, 'detail' => $detail,
        ]);

        if (!$to) { $log('skipped', $channel === 'email' ? 'No email address' : 'No mobile number'); return; }

        try {
            if ($channel === 'email') {
                foreach (self::NO_MAIL as $re) if (preg_match($re, $to)) { $log('skipped', 'Demo or reserved address'); return; }
                Notification::route('mail', $to)->notify(new LoadUpdateNotification($subject, $lines, $track));
                $log('sent');
                return;
            }

            // Text: Twilio when configured, and never from local or test environments
            $sid = config('services.twilio.sid'); $token = config('services.twilio.token'); $from = config('services.twilio.from');
            if (!$sid || !$token || !$from) { $log('skipped', 'Texting is not set up'); return; }
            if (app()->environment(['local', 'testing'])) { $log('skipped', 'Texts are not sent from ' . app()->environment()); return; }
            $res = Http::asForm()->withBasicAuth($sid, $token)->timeout(10)
                ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", [
                    'To' => $to, 'From' => $from, 'Body' => $subject . ($track ? " {$track}" : ''),
                ]);
            $res->successful() ? $log('sent') : $log('failed', 'Twilio ' . $res->status());
        } catch (\Throwable $e) {
            $log('failed', substr($e->getMessage(), 0, 250));
        }
    }

    private function message(FreightJob $job, JobStop $stop, string $place, string $event): array
    {
        $load    = $job->title ?: "Load #{$job->id}";
        $carrier = $job->carrier ? PersonChecks::companyName($job->carrier) : 'The carrier';
        $what    = $stop->stop_type === 'pickup' ? 'pickup' : 'delivery';
        $when    = $stop->scheduled_date ? ' on ' . $stop->scheduled_date->format('M j') : '';

        return match ($event) {
            'booked'   => ["Carrier booked: {$load}", ["{$carrier} is booked for {$load}.", "The {$what} at {$place} is scheduled{$when}."]],
            'en_route' => ["On the way to {$place}: {$load}", ["{$carrier} is on the way to {$place} for the {$what} of {$load}."]],
            'arrived'  => ["Arrived at {$place}: {$load}", ["{$carrier} has arrived at {$place} for the {$what} of {$load}."]],
            default    => [($what === 'pickup' ? 'Picked up' : 'Delivered') . " at {$place}: {$load}",
                           [($what === 'pickup' ? 'The freight was picked up' : 'The freight was delivered') . " at {$place} for {$load}."]],
        };
    }
}
