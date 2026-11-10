<?php

namespace App\Support;

use App\Services\Background\BackgroundChecks;
use App\Services\Checks\Kyb;
use App\Services\FmcsaService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/**
 * Every outside service the platform uses (Admin, Integrations). Keys are only reported as set or not set,
 * never their values. Prices are as published or quoted in Nov 2026 (demo/compliance-checks.html).
 */
class Integrations
{
    /** [env name, config path] */
    private static function keys(array $pairs): array
    {
        return array_map(fn ($p) => ['name' => $p[0], 'set' => (string) config($p[1]) !== ''], $pairs);
    }

    private static function prefix(string $path, string $test, string $live): ?string
    {
        $k = (string) config($path);
        return $k === '' ? null : (str_starts_with($k, $live) ? 'live' : (str_starts_with($k, $test) ? 'test' : null));
    }

    public static function all(): array
    {
        $base = rtrim((string) config('app.url'), '/') . '/api/v1';
        $kyb = Kyb::settings();
        $bg = BackgroundChecks::settings();
        $inUse = fn (string $group, string $key) => ($group === 'kyb' ? $kyb['provider'] : $bg['provider']) === $key;

        return [
            // ── Payments ──
            ['key' => 'stripe', 'group' => 'Payments', 'name' => 'Stripe', 'used_for' => 'Card and bank account payments, subscriptions (Billing), carrier and factor payouts (Connect), and the owner\'s ID check (Identity)',
             'cost' => 'Identity $1.50 per check · Connect $2 per active account a month + 0.25% + $0.25 per payout · Billing 0.5–0.8% · cards at standard rates',
             'keys' => self::keys([['STRIPE_SECRET_KEY', 'services.stripe.secret'], ['STRIPE_WEBHOOK_SECRET', 'services.stripe.webhook_secret'], ['STRIPE_CONNECT_WEBHOOK_SECRET', 'services.stripe.connect_webhook_secret']]),
             'mode' => self::prefix('services.stripe.secret', 'sk_test', 'sk_live'), 'webhook' => "{$base}/stripe/webhook", 'testable' => true, 'settings' => '/admin/settings'],

            // ── Business verification ──
            ['key' => 'middesk', 'group' => 'Business verification', 'name' => 'Middesk', 'used_for' => 'Shipper, broker and factor checks: EIN with the IRS, state registration, address, sanctions, officers',
             'cost' => 'Quote from sales', 'in_use' => $inUse('kyb', 'middesk'),
             'keys' => self::keys([['MIDDESK_TEST_KEY', 'services.middesk.test_key'], ['MIDDESK_LIVE_KEY', 'services.middesk.live_key'], ['MIDDESK_WEBHOOK_SECRET', 'services.middesk.webhook_secret']]),
             'mode' => $inUse('kyb', 'middesk') ? Kyb::mode() : null, 'webhook' => "{$base}/kyb/webhook/middesk", 'testable' => true, 'settings' => '/admin/settings'],
            ['key' => 'didit', 'group' => 'Business verification', 'name' => 'Didit', 'used_for' => 'Backup for Middesk: state registration, officers, sanctions, and the EIN read from the W-9 (no IRS match)',
             'cost' => 'About $2.70–3.90 per company (search $0.50, registry $2–3, sanctions $0.20, W-9 $0.20) · sandbox free', 'in_use' => $inUse('kyb', 'didit'),
             'keys' => self::keys([['DIDIT_API_KEY', 'services.didit.key'], ['DIDIT_WEBHOOK_SECRET', 'services.didit.webhook_secret']]),
             'mode' => self::prefix('services.didit.key', 'sk_test_', 'sk_live_'), 'webhook' => "{$base}/kyb/webhook/didit", 'testable' => true, 'settings' => '/admin/settings'],

            // ── Background checks ──
            ['key' => 'checkr', 'group' => 'Background checks', 'name' => 'Checkr', 'used_for' => 'Owner and driver background checks and driving records (MVR)',
             'cost' => 'Basic $29.99 · Essential $59.99 · Complete $94.99 per report · MVR about $9.50 · court and DMV fees extra', 'in_use' => $inUse('bg', 'checkr'),
             'keys' => self::keys([['CHECKR_TEST_KEY', 'services.checkr.test_key'], ['CHECKR_LIVE_KEY', 'services.checkr.live_key']]),
             'mode' => $inUse('bg', 'checkr') ? BackgroundChecks::mode() : null, 'webhook' => "{$base}/background/webhook/checkr", 'testable' => true, 'settings' => '/admin/settings'],
            ['key' => 'clearinghouse', 'group' => 'Background checks', 'name' => 'FMCSA Clearinghouse', 'used_for' => 'Drivers\' drug and alcohol violations',
             'cost' => '$1.25 per query, or $24,500 a year unlimited',
             'keys' => self::keys([['CLEARINGHOUSE_API_KEY', 'services.clearinghouse.api_key'], ['CLEARINGHOUSE_ORG_ID', 'services.clearinghouse.org_id'], ['CLEARINGHOUSE_WEBHOOK_SECRET', 'services.clearinghouse.webhook_secret']]),
             'mode' => null, 'webhook' => "{$base}/clearinghouse/webhook", 'testable' => false,
             'note' => 'Not confirmed that FMCSA offers an API for third-party queries; it may be web portal only.'],

            // ── Public registers ──
            ['key' => 'fmcsa', 'group' => 'Public registers', 'name' => 'FMCSA QCMobile', 'used_for' => 'USDOT and MC lookup, operating authority, insurance and bond on file',
             'cost' => 'Free', 'keys' => self::keys([['FMCSA_API_KEY', 'services.fmcsa.key']]), 'mode' => null, 'webhook' => null, 'testable' => true],
            ['key' => 'fmcsa_open', 'group' => 'Public registers', 'name' => 'FMCSA public data', 'used_for' => 'Insurance filings, BOC-3, authority history, revocations, SMS safety scores (data.transportation.gov)',
             'cost' => 'Free', 'keys' => [], 'mode' => null, 'webhook' => null, 'testable' => true],
            ['key' => 'sam_gov', 'group' => 'Public registers', 'name' => 'SAM.gov', 'used_for' => 'Government entity registration (UEI)',
             'cost' => 'Free', 'keys' => self::keys([['SAM_GOV_API_KEY', 'services.sam_gov.key']]), 'mode' => null, 'webhook' => null, 'testable' => true],
            ['key' => 'eia', 'group' => 'Public registers', 'name' => 'EIA diesel price', 'used_for' => 'Weekly US diesel price for the fuel surcharge in rate checks',
             'cost' => 'Free', 'keys' => self::keys([['EIA_API_KEY', 'services.eia.key']]), 'mode' => null, 'webhook' => null, 'testable' => true],
            ['key' => 'nhtsa', 'group' => 'Public registers', 'name' => 'NHTSA VIN decoder', 'used_for' => 'Checking a vehicle\'s VIN',
             'cost' => 'Free', 'keys' => [], 'mode' => null, 'webhook' => null, 'testable' => true],

            // ── Messaging and storage ──
            ['key' => 'twilio', 'group' => 'Messaging and storage', 'name' => 'Twilio', 'used_for' => 'SMS codes to verify phone numbers',
             'cost' => 'About $0.06 per verification ($0.05 + about $0.008 per text)',
             'keys' => self::keys([['TWILIO_ACCOUNT_SID', 'services.twilio.sid'], ['TWILIO_AUTH_TOKEN', 'services.twilio.token'], ['TWILIO_VERIFY_SID', 'services.twilio.verify_sid']]),
             'mode' => null, 'webhook' => null, 'testable' => true],
            ['key' => 'mail', 'group' => 'Messaging and storage', 'name' => 'Email', 'used_for' => 'All email the platform sends',
             'cost' => 'Depends on the mail service', 'keys' => [], 'mode' => null, 'webhook' => null, 'testable' => false,
             'note' => 'Sending with: ' . config('mail.default') . (config('mail.default') === 'log' ? ' (written to the log, not sent)' : '')],
            ['key' => 'r2', 'group' => 'Messaging and storage', 'name' => 'Cloudflare R2', 'used_for' => 'Uploaded documents and photos',
             'cost' => 'Storage and requests by usage',
             'keys' => self::keys([['CLOUDFLARE_R2_ACCESS_KEY_ID', 'filesystems.disks.r2.key'], ['CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'filesystems.disks.r2.secret'], ['CLOUDFLARE_R2_BUCKET', 'filesystems.disks.r2.bucket'], ['CLOUDFLARE_R2_ENDPOINT', 'filesystems.disks.r2.endpoint']]),
             'mode' => null, 'webhook' => null, 'testable' => true,
             'note' => (string) config('filesystems.disks.r2.key') === '' ? 'Not set, so files are kept on this server\'s disk' : null],
        ];
    }

    /** Make one harmless call to the service. Returns the message to show; throws when it fails. */
    public static function test(string $key): string
    {
        $need = function (array $paths) { foreach ($paths as $p) if ((string) config($p) === '') throw new \RuntimeException('Key not set on the server.'); };
        switch ($key) {
            case 'stripe':
                $need(['services.stripe.secret']);
                if (self::prefix('services.stripe.secret', 'sk_test', 'sk_live') === 'live' && app()->environment('local')) throw new \RuntimeException('A live Stripe key is not called from a developer\'s computer.');
                Http::withToken(config('services.stripe.secret'))->timeout(15)->get('https://api.stripe.com/v1/balance')->throw();
                return 'Connected to Stripe (' . (self::prefix('services.stripe.secret', 'sk_test', 'sk_live') ?? 'unknown') . ' mode).';
            case 'middesk':
            case 'didit':
                return Kyb::provider($key)->testConnection($key === 'didit' && self::prefix('services.didit.key', 'sk_test_', 'sk_live_') === 'live' ? 'live' : Kyb::mode());
            case 'checkr':
                return BackgroundChecks::provider('checkr')->testConnection(BackgroundChecks::mode());
            case 'fmcsa':
                $need(['services.fmcsa.key']);
                if (!app(FmcsaService::class)->lookupByDot('54283')) throw new \RuntimeException('FMCSA did not return a known carrier; the key may be wrong.');
                return 'Connected to FMCSA QCMobile.';
            case 'fmcsa_open':
                Http::timeout(15)->get('https://data.transportation.gov/resource/4y6x-dmck.json', ['$limit' => 1])->throw();
                return 'data.transportation.gov answered.';
            case 'sam_gov':
                $need(['services.sam_gov.key']);
                $n = Http::timeout(20)->acceptJson()->get('https://api.sam.gov/entity-information/v3/entities', ['api_key' => config('services.sam_gov.key'), 'registrationStatus' => 'A', 'page' => 0, 'size' => 1])->throw()->json('totalRecords');
                return 'Connected to SAM.gov (' . number_format((int) $n) . ' active registrations).';
            case 'eia':
                $need(['services.eia.key']);
                $d = \App\Services\Rates\DieselPrice::fetch((string) config('services.eia.key'));
                if (!$d) throw new \RuntimeException('EIA answered but returned no diesel price.');
                return 'Connected to EIA (diesel $' . number_format($d['price'], 3) . ' a gallon, week of ' . $d['period'] . ').';
            case 'nhtsa':
                Http::timeout(15)->get('https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/truck', ['format' => 'json'])->throw();
                return 'NHTSA vPIC answered.';
            case 'twilio':
                $need(['services.twilio.sid', 'services.twilio.token']);
                Http::withBasicAuth(config('services.twilio.sid'), config('services.twilio.token'))->timeout(15)->get('https://api.twilio.com/2010-04-01/Accounts/' . config('services.twilio.sid') . '.json')->throw();
                return 'Connected to Twilio.';
            case 'r2':
                $need(['filesystems.disks.r2.key', 'filesystems.disks.r2.bucket']);
                Storage::disk('r2')->exists('connection-test');
                return 'Connected to the R2 bucket.';
        }
        throw new \RuntimeException('This service has no connection test.');
    }
}
