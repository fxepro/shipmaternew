<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// People whose required credentials (CDL, medical card, ...) have expired go back to review.
// See docs/people-types-and-checks.md. Also re-checked whenever a driver is assigned.
Artisan::command('people:refresh-checks', function () {
    $moved = 0;
    App\Models\PersonVerification::where('status', 'approved')->with('user')->chunkById(200, function ($rows) use (&$moved) {
        foreach ($rows as $pv) {
            if ($pv->user && App\Services\PersonChecks::refresh($pv->user)->status !== 'approved') $moved++;
        }
    });
    $this->info("{$moved} approved people moved back to review.");
})->purpose('Send approved people with expired or failed required items back to review');

Schedule::command('people:refresh-checks')->dailyAt('06:00');

// Load payments: card holds the day before pickup, and charges before a hold expires (docs/fees-and-billing.md)
Artisan::command('payments:run', function () {
    $r = app(App\Services\Payments\LoadPayments::class)->run();
    $this->info("Held {$r['held']}, re-held {$r['retried']}, charged {$r['charged']}.");
})->purpose('Place card holds due before pickup and charge holds about to expire');

Schedule::command('payments:run')->hourly()->withoutOverlapping();
