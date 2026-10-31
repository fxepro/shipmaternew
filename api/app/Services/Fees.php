<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Shipmater's fees, set by admins (Platform → Fees). See docs/fees-and-billing.md.
 * Every load fee is paid by the carrier; the only discount is the early-payment rate.
 */
class Fees
{
    private const DEFAULTS = [
        'standard_rate'  => 0.10,
        'early_rate'     => 0.075,
        'onboarding_fee' => 99,
        'tiers'          => [],
    ];

    public static function all(): array
    {
        return Cache::remember('platform_fees', 300, function () {
            $row = DB::table('platform_settings')->where('key', 'fees')->value('value');
            return array_merge(self::DEFAULTS, $row ? json_decode($row, true) : []);
        });
    }

    public static function save(array $fees, ?int $userId): array
    {
        DB::table('platform_settings')->updateOrInsert(
            ['key' => 'fees'],
            ['value' => json_encode($fees), 'updated_by' => $userId, 'updated_at' => now()]
        );
        Cache::forget('platform_fees');

        return self::all();
    }

    /** X — the fee on every load */
    public static function standardRate(): float
    {
        return (float) self::all()['standard_rate'];
    }

    /** Y — the fee when the shipper pays at booking */
    public static function earlyRate(): float
    {
        return (float) self::all()['early_rate'];
    }

    public static function rateFor(bool $earlyPayment): float
    {
        return $earlyPayment ? self::earlyRate() : self::standardRate();
    }

    /** Subscription tiers, smallest first */
    public static function tiers(): array
    {
        return self::all()['tiers'];
    }

    /** The tier for a yearly load value */
    public static function tierFor(float $annualValue): ?array
    {
        foreach (self::tiers() as $tier) {
            if ($tier['max_annual_value'] === null || $annualValue <= (float) $tier['max_annual_value']) {
                return $tier;
            }
        }
        return null;
    }

    public static function tier(string $key): ?array
    {
        return collect(self::tiers())->firstWhere('key', $key);
    }
}
