<?php

namespace App\Support;

use App\Models\Organization;
use App\Models\PersonVerification;
use App\Models\User;
use App\Services\PersonChecks;

/**
 * Whether a person's company may do business on the platform: post loads, see the load board, make and
 * accept offers, run loads and act as a factor. Only an approved company may (an admin's "approve anyway"
 * sets it approved). A restricted company (overdue compliance) may finish loads it already has, nothing new.
 * A carrier's owner must also be approved as a person. Receivers have no approval and are never blocked.
 */
class Approval
{
    public const TYPES = ['carrier', 'shipper', 'broker', 'factor'];

    /** Why the person is blocked, or null when they may go ahead */
    public static function blocked(?User $user, bool $allowRestricted = false): ?array
    {
        // An admin viewing a company reads it whatever its approval
        if (!$user || $user->viewingAs) return null;

        $m = PersonChecks::membership($user);
        $org = $m['org'] ?? null;
        if (!$org instanceof Organization || !in_array($org->type, self::TYPES, true)) return null;

        $ok = $org->verification_status === 'approved' || ($allowRestricted && $org->verification_status === 'restricted');
        if (!$ok) {
            return [
                'error' => $org->verification_status === 'restricted'
                    ? 'Your company is restricted until its overdue compliance items are updated.'
                    : 'Your company is waiting for approval. You can do this once Shipmater approves it.',
                'verification_status' => $org->verification_status, 'code' => 'company_not_approved',
            ];
        }

        if ($org->type === 'carrier' && ($m['role'] ?? null) === 'owner') {
            $status = PersonVerification::where('user_id', $user->id)->value('status') ?? 'incomplete';
            if ($status !== 'approved') {
                return ['error' => 'You need to be approved as the carrier\'s owner first.', 'verification_status' => $status, 'code' => 'carrier_not_approved'];
            }
        }
        return null;
    }

    public static function companyApproved(?Organization $org): bool
    {
        return $org?->verification_status === 'approved';
    }
}
