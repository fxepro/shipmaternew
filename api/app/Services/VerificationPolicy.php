<?php

namespace App\Services;

use App\Models\Organization;
use App\Support\ComplianceRules;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Which verification checks each type of company must pass, as admins set it (Admin Console, Compliance).
 *
 * Settings per type and check:
 *   required  blocks approval until passed
 *   optional  shown, never blocks
 *   deferred  the company gets in now and has N days; once overdue it blocks again (and an approved company is restricted)
 *   off       not asked, not shown
 * An open-season promotion can drop checks to deferred or off while it runs. Companies that joined during it
 * get the promotion's catch-up days after it ends.
 */
class VerificationPolicy
{
    public const SETTINGS = ['required', 'optional', 'deferred', 'off'];
    public const DEFAULT_DEFER_DAYS = 30;

    private static ?array $rows = null;
    private static ?array $promos = null;

    /** Every check a type can have, in the order the verification table shows them: key, label, group, default */
    public static function catalog(string $type): array
    {
        $c = [];
        $add = function (string $key, string $label, string $group, bool $required) use (&$c) {
            $c[] = ['key' => $key, 'label' => $label, 'group' => $group, 'default' => $required ? 'required' : 'optional'];
        };

        $add('owner_email', 'Owner email verified', 'Account', true);
        if (in_array($type, ['shipper', 'factor', 'broker'], true)) $add('address', 'Registered address', 'Business', true);
        if ($type === 'shipper') {
            $add('phone_verified', 'Business phone verified', 'Business', false);
            $add('submitted', 'Submitted for review', 'Business', false);
        }
        foreach (ComplianceRules::items((new Organization)->forceFill(['type' => $type]), false) as $i) {
            $add($i['key'], $i['label'], $i['section'], $i['required']);
        }
        if ($type === 'carrier') $add('documents', 'Documents reviewed', 'Documents', false);
        if ($type === 'shipper') $add('documents', 'Business documents', 'Documents', false);
        if ($type === 'carrier') {
            $add('owner_approved', 'Owner approved (identity and background)', 'People', true);
            $add('drivers_approved', 'Drivers approved', 'People', false);
            $add('vehicles', 'Vehicles on file', 'Fleet', false);
        }
        if ($type !== 'receiver') $add('background', 'Company background check', 'Background', true);
        if ($type === 'carrier') $add('payouts', 'Payouts set up', 'Money', true);
        if ($type === 'shipper') {
            $add('payment_method', 'Payment method on file', 'Money', true);
            $add('subscription', 'Subscription active (needed to post loads)', 'Money', true);
        }
        return $c;
    }

    /** The admin's setting for a check, before any promotion: [setting, defer_days] */
    public static function base(string $type, string $key, string $default): array
    {
        self::$rows ??= DB::table('verification_policies')->get()->keyBy(fn ($r) => "{$r->type}.{$r->check_key}")->all();
        $r = self::$rows["{$type}.{$key}"] ?? null;
        return [$r->setting ?? $default, $r->defer_days ?? self::DEFAULT_DEFER_DAYS];
    }

    public static function promotions(): array
    {
        return self::$promos ??= DB::table('compliance_promotions')->get()->map(function ($p) {
            $p->types = json_decode($p->types, true) ?: [];
            $p->settings = json_decode($p->settings, true) ?: [];
            $p->starts_at = Carbon::parse($p->starts_at);
            $p->ends_at = Carbon::parse($p->ends_at);
            return $p;
        })->all();
    }

    /** The promotion running now for a type, if any */
    public static function activePromotion(string $type): ?object
    {
        foreach (self::promotions() as $p) {
            if (in_array($type, $p->types, true) && now()->between($p->starts_at, $p->ends_at)) return $p;
        }
        return null;
    }

    /**
     * Where a check stands for one company: setting (as applied), due date for deferred, promotion name.
     * Returns null when the check is off.
     */
    public static function effective(Organization $o, string $key, string $default): ?array
    {
        [$setting, $days] = self::base($o->type, $key, $default);
        $due = null; $promo = null;

        if ($setting === 'deferred') {
            $due = ($o->created_at ?? now())->copy()->addDays($days);
        }

        // Open season running now
        $p = self::activePromotion($o->type);
        if ($p && isset($p->settings[$o->type][$key]) && in_array($setting, ['required', 'deferred'], true)) {
            $setting = $p->settings[$o->type][$key];
            $promo = $p->name;
            $due = $setting === 'deferred' ? $p->ends_at->copy()->addDays($p->catch_up_days) : null;
        }

        // Joined during an open season that has ended: relaxed checks get the catch-up window
        if (!$p && $o->joined_promotion_id && in_array($setting, ['required'], true)) {
            $jp = collect(self::promotions())->firstWhere('id', $o->joined_promotion_id);
            if ($jp && isset($jp->settings[$o->type][$key]) && now()->greaterThan($jp->ends_at)) {
                $setting = 'deferred';
                $promo = $jp->name;
                $due = $jp->ends_at->copy()->addDays($jp->catch_up_days);
            }
        }

        if ($setting === 'off') return null;
        return ['setting' => $setting, 'due' => $due, 'promotion' => $promo, 'overdue' => $due && now()->greaterThan($due)];
    }

    /**
     * Apply the policy to a check row ({key, required, state, ...}). Returns null when the check is off.
     * required = blocks approval: a required check, or a deferred one that is overdue and not passed.
     */
    public static function apply(Organization $o, array $row): ?array
    {
        $e = self::effective($o, $row['key'], $row['required'] ? 'required' : 'optional');
        if (!$e) return null;
        $passed = ($row['state'] ?? null) === 'passed';
        $row['setting']   = $e['setting'];
        $row['due']       = $e['due']?->toDateString();
        $row['promotion'] = $e['promotion'];
        $row['overdue']   = $e['overdue'] && !$passed;
        $row['required']  = $e['setting'] === 'required' || $row['overdue'];
        if ($e['setting'] === 'deferred' && !$passed) {
            $row['detail'] = trim(($row['detail'] ? $row['detail'] . ' · ' : '') . ($row['overdue'] ? 'Overdue since ' : 'Deferred, due ') . $e['due']->toFormattedDateString());
        }
        return $row;
    }

    public static function approvalMode(string $type): string
    {
        return DB::table('verification_type_settings')->where('type', $type)->value('approval_mode') ?? 'manual';
    }

    /** Forget cached settings (after an admin change) */
    public static function flush(): void
    {
        self::$rows = null;
        self::$promos = null;
    }
}
