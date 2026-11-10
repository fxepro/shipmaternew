<?php

namespace App\Support;

use App\Services\Background\BackgroundChecks;
use App\Services\Checks\Kyb;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * One Test / Live switch for every outside check (Admin → Platform, top of the page).
 * Business verification and background checks both read it. Stripe's mode comes from the key on the server, not from here.
 * Live is never used on a developer's computer.
 */
class PlatformMode
{
    public static function stored(): string
    {
        $v = Cache::remember('platform_mode', 300, fn () => DB::table('platform_settings')->where('key', 'mode')->value('value'));
        if ($v) return json_decode($v, true) === 'live' ? 'live' : 'test';
        // Before the single switch: live only if both checks were live
        return (Kyb::settings()['mode'] ?? 'test') === 'live' && (BackgroundChecks::settings()['mode'] ?? 'test') === 'live' ? 'live' : 'test';
    }

    public static function liveAllowed(): bool
    {
        return !app()->environment('local', 'testing');
    }

    /** The mode checks run in right now */
    public static function current(): string
    {
        return self::liveAllowed() && self::stored() === 'live' ? 'live' : 'test';
    }

    public static function save(string $mode, ?int $userId): void
    {
        DB::table('platform_settings')->updateOrInsert(['key' => 'mode'], ['value' => json_encode($mode), 'updated_by' => $userId, 'updated_at' => now()]);
        Cache::forget('platform_mode');
    }

    /** Whether each service has what it needs for live mode */
    public static function services(): array
    {
        $kyb = Kyb::provider();
        $bg = BackgroundChecks::provider();
        $stripe = (string) config('services.stripe.secret');
        return [
            ['key' => 'kyb', 'name' => "Business verification ({$kyb->name()})", 'switch' => true, 'live_ready' => $kyb->configured('live')],
            ['key' => 'background', 'name' => "Background checks ({$bg->name()})", 'switch' => true, 'live_ready' => $bg->configured('live')],
            ['key' => 'stripe', 'name' => 'Stripe payments', 'switch' => false,
                'live_ready' => str_starts_with($stripe, 'sk_live_'),
                'note' => $stripe === '' ? 'No key on the server' : (str_starts_with($stripe, 'sk_live_') ? 'Live key on the server' : 'Test key on the server') . '; set by the key, not this switch'],
        ];
    }
}
