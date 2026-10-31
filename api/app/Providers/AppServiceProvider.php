<?php

namespace App\Providers;

use App\Services\TenantMailerService;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TenantMailerService::class);
        // Load payments: real Stripe, or no Stripe calls at all for local testing (PAYMENTS_DRIVER=fake)
        $this->app->bind(\App\Services\Payments\Gateway::class, fn () => config('payments.driver') === 'fake'
            ? new \App\Services\Payments\FakeGateway()
            : new \App\Services\Payments\StripeGateway());
    }

    public function boot(): void
    {
        //
    }
}
