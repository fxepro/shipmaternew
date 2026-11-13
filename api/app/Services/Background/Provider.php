<?php

namespace App\Services\Background;

use Illuminate\Http\Request;

/**
 * A background check provider. BackgroundChecks is the only caller: pages and controllers never talk to one directly.
 * Methods throw \RuntimeException with a message fit to show the user.
 */
interface Provider
{
    /** checkr | foley | fake */
    public function name(): string;

    /** Keys for this mode are set */
    public function configured(string $mode): bool;

    /** @param array{first_name:string,last_name:string,email:string,dob:string,state:?string} $person  Returns the candidate id */
    public function createCandidate(array $person, string $mode): string;

    /** Hosted form where the person gives consent and enters their SSN. Returns ['id' => …, 'url' => …] */
    public function invite(string $candidateId, string $package, ?string $state, string $mode): array;

    /**
     * Verify and read a webhook. null = signature invalid; [] = nothing to act on; otherwise
     * ['mode', 'event' => invitation_completed|invitation_expired|report_created|report_completed|adverse_action,
     *  'candidate_id', 'invitation_id', 'report_id', 'result' => clear|consider|null]
     */
    public function parseWebhook(Request $request): ?array;

    /** The provider's full report as PDF bytes, or null when it doesn't offer one (yet) */
    public function reportPdf(string $reportId, string $mode): ?string;

    /** A short line saying the connection works, e.g. "Connected — 4 packages" */
    public function testConnection(string $mode): string;
}
