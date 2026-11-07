<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * What each role in a company may do, by company type (Admin Console, Settings, Roles & Permissions).
 *
 * The actions are fixed here because each one needs a matching check in the API. Admins change the
 * level a role has for an action; the defaults below apply until they do. The owner always has full
 * access, and everyone always manages their own identity and checks.
 *
 * Levels: full (can do it), view (read only), assigned (only loads they are on), self (own record only),
 * none (no access).
 */
class Permissions
{
    public const LEVELS = ['full', 'view', 'assigned', 'self', 'none'];

    public const ROLES = [
        'carrier' => ['owner', 'staff', 'dispatcher', 'driver', 'viewer'],
        'shipper' => ['owner', 'staff', 'viewer'],
        'factor'  => ['owner', 'staff', 'viewer'],
        'receiver' => ['owner', 'staff', 'viewer'],
    ];

    private const DO   = ['full', 'none'];
    private const AREA = ['full', 'view', 'none'];
    private const LOAD = ['full', 'view', 'assigned', 'none'];
    private const RUN  = ['full', 'assigned', 'none'];
    private const SELF = ['self'];

    /**
     * type => [action => [group, label, allowed levels, defaults by role (in ROLES order)]]
     */
    public const CATALOG = [
        'carrier' => [
            'company.profile'    => ['Company', 'Company profile, DOT and MC, documents', self::AREA, ['full', 'full', 'view', 'none', 'view']],
            'company.payouts'    => ['Company', 'Bank account, payouts and Stripe setup', self::AREA, ['full', 'view', 'none', 'none', 'none']],
            'team.manage'        => ['Company', 'Team: invite, change role, remove', self::DO, ['full', 'full', 'none', 'none', 'none']],
            'loads.board'        => ['Loads', 'Load board: find loads and freight jobs', self::AREA, ['full', 'full', 'full', 'none', 'view']],
            'loads.bid'          => ['Loads', 'Bid, make offers, withdraw', self::DO, ['full', 'full', 'full', 'none', 'none']],
            'loads.accept'       => ['Loads', 'Accept an offered load', self::DO, ['full', 'full', 'full', 'none', 'none']],
            'loads.view'         => ['Loads', 'Company loads list and detail', self::LOAD, ['full', 'full', 'full', 'assigned', 'view']],
            'loads.assign'       => ['Loads', 'Assign or change the driver', self::DO, ['full', 'full', 'full', 'none', 'none']],
            'trips.run'          => ['Trips', 'Start trip, location pings, deliver', self::RUN, ['full', 'none', 'full', 'assigned', 'none']],
            'trips.stops'        => ['Trips', 'Stop updates, photos, POD, signature', self::RUN, ['full', 'full', 'full', 'assigned', 'none']],
            'trips.documents'    => ['Trips', 'BOL, rate confirmation, invoice', self::LOAD, ['full', 'full', 'full', 'assigned', 'view']],
            'contracts.view'     => ['Contracts', 'Contracts: view', self::AREA, ['full', 'full', 'full', 'none', 'view']],
            'contracts.sign'     => ['Contracts', 'Contracts: accept and sign', self::DO, ['full', 'none', 'none', 'none', 'none']],
            'fleet.vehicles'     => ['Fleet', 'Vehicles', self::AREA, ['full', 'full', 'view', 'view', 'view']],
            'fleet.drivers'      => ['Fleet', 'Drivers list and their check status', self::AREA, ['full', 'full', 'full', 'none', 'view']],
            'money.payments'     => ['Money', 'Earnings, payments and fees', self::AREA, ['full', 'full', 'none', 'none', 'none']],
            'money.factoring'    => ['Money', 'Factoring: request, NOAs', self::DO, ['full', 'full', 'none', 'none', 'none']],
            'checks.pay'         => ['Money', 'Background checks: pay for drivers', self::DO, ['full', 'full', 'none', 'none', 'none']],
            'ratings.give'       => ['Other', 'Rate shippers', self::DO, ['full', 'full', 'full', 'none', 'none']],
            'self.checks'        => ['Other', 'Own identity, credentials and checks', self::SELF, ['self', 'self', 'self', 'self', 'self']],
        ],
        'shipper' => [
            'company.profile'    => ['Company', 'Company profile, business, branding, verification', self::AREA, ['full', 'full', 'view']],
            'company.subscription' => ['Company', 'Subscription', self::AREA, ['full', 'view', 'none']],
            'team.manage'        => ['Company', 'Team: invite, change role, remove', self::DO, ['full', 'full', 'none']],
            'money.methods'      => ['Money', 'Payment methods and bank (Plaid): add and remove', self::DO, ['full', 'none', 'none']],
            'money.pay'          => ['Money', 'Pay for loads with saved methods', self::DO, ['full', 'full', 'none']],
            'money.payments'     => ['Money', 'Payments and invoices', self::AREA, ['full', 'full', 'view']],
            'factoring.acknowledge' => ['Money', 'Acknowledge factoring notices', self::DO, ['full', 'full', 'none']],
            'loads.post'         => ['Loads', 'Post loads and freight jobs, edit terms and billing', self::DO, ['full', 'full', 'none']],
            'loads.decide'       => ['Loads', 'Accept or decline bids and offers', self::DO, ['full', 'full', 'none']],
            'loads.view'         => ['Loads', 'Shipments, tracking, documents', self::AREA, ['full', 'full', 'view']],
            'locations.manage'   => ['Loads', 'Locations', self::AREA, ['full', 'full', 'view']],
            'contracts.edit'     => ['Contracts', 'Contracts: create and edit', self::AREA, ['full', 'full', 'view']],
            'contracts.sign'     => ['Contracts', 'Contracts: sign', self::DO, ['full', 'none', 'none']],
            'carriers.preferred' => ['Carriers', 'Preferred carriers', self::AREA, ['full', 'full', 'view']],
            'carriers.checks'    => ['Carriers', 'Carrier background results (active contract only)', self::AREA, ['full', 'full', 'view']],
            'carriers.order_check' => ['Carriers', 'Order a Complete check for a carrier (pays)', self::DO, ['full', 'full', 'none']],
            'ratings.give'       => ['Other', 'Rate carriers', self::DO, ['full', 'full', 'none']],
            'self.checks'        => ['Other', 'Own identity and checks', self::SELF, ['self', 'self', 'self']],
        ],
        'factor' => [
            'company.profile'    => ['Company', 'Company profile', self::AREA, ['full', 'full', 'view']],
            'company.payouts'    => ['Company', 'Bank account, payouts and Stripe setup', self::AREA, ['full', 'view', 'none']],
            'team.manage'        => ['Company', 'Team: invite, change role, remove', self::DO, ['full', 'full', 'none']],
            'noas.decide'        => ['Factoring', 'NOAs: approve, reject, release', self::DO, ['full', 'full', 'none']],
            'loads.decide'       => ['Factoring', 'Factored loads: approve, reject, mark funded', self::DO, ['full', 'full', 'none']],
            'loads.view'         => ['Factoring', 'Loads, NOAs and payments', self::AREA, ['full', 'full', 'view']],
            'self.checks'        => ['Other', 'Own identity and checks', self::SELF, ['self', 'self', 'self']],
        ],
        'receiver' => [
            'company.profile'    => ['Company', 'Company details', self::AREA, ['full', 'full', 'view']],
            'team.manage'        => ['Company', 'Team: invite, change role, remove', self::DO, ['full', 'full', 'none']],
            'locations.manage'   => ['Company', 'Locations: add, edit, remove', self::AREA, ['full', 'full', 'view']],
            'contacts.manage'    => ['Company', 'Contacts and their load updates', self::AREA, ['full', 'full', 'view']],
            'loads.view'         => ['Deliveries', 'Loads coming to our locations, tracking', self::AREA, ['full', 'full', 'view']],
            'self.checks'        => ['Other', 'Own identity', self::SELF, ['self', 'self', 'self']],
        ],
    ];

    private const CACHE_KEY = 'role_permissions.v1';

    /** The default level for a role and action */
    public static function default(string $type, string $role, string $action): string
    {
        $i = array_search($role, self::ROLES[$type] ?? [], true);
        $entry = self::CATALOG[$type][$action] ?? null;
        return ($entry && $i !== false) ? $entry[3][$i] : 'none';
    }

    /** Whether a role's level for an action can be changed (owner and own-record rows are fixed) */
    public static function editable(string $type, string $role, string $action): bool
    {
        $entry = self::CATALOG[$type][$action] ?? null;
        return $entry && $role !== 'owner' && count($entry[2]) > 1;
    }

    /** Admin changes, as [type][role][action] => level */
    private static function overrides(): array
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            $out = [];
            foreach (DB::table('role_permissions')->get(['org_type', 'role', 'permission', 'level']) as $r) {
                $out[$r->org_type][$r->role][$r->permission] = $r->level;
            }
            return $out;
        });
    }

    public static function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /** The level a role has for an action now */
    public static function level(?string $type, ?string $role, string $action): string
    {
        if (!$type || !$role || !isset(self::CATALOG[$type][$action])) return 'none';
        if ($role === 'owner') return self::default($type, 'owner', $action);
        $level = self::overrides()[$type][$role][$action] ?? self::default($type, $role, $action);
        return in_array($level, self::CATALOG[$type][$action][2], true) ? $level : self::default($type, $role, $action);
    }

    /** Every action's level for one role, for the /user response */
    public static function forRole(?string $type, ?string $role): array
    {
        if (!$type || !$role || !isset(self::CATALOG[$type])) return [];
        $out = [];
        foreach (array_keys(self::CATALOG[$type]) as $action) $out[$action] = self::level($type, $role, $action);
        return $out;
    }

    /** The whole matrix for one type, for the admin page */
    public static function matrix(string $type): array
    {
        $roles = self::ROLES[$type];
        $actions = [];
        foreach (self::CATALOG[$type] as $key => [$group, $label, $levels, $defaults]) {
            $actions[] = [
                'key'      => $key,
                'group'    => $group,
                'label'    => $label,
                'levels'   => $levels,
                'defaults' => array_combine($roles, $defaults),
                'values'   => array_combine($roles, array_map(fn ($r) => self::level($type, $r, $key), $roles)),
                'editable' => array_combine($roles, array_map(fn ($r) => self::editable($type, $r, $key), $roles)),
            ];
        }
        return ['type' => $type, 'roles' => $roles, 'actions' => $actions];
    }
}
