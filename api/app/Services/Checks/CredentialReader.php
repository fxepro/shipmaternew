<?php

namespace App\Services\Checks;

use App\Models\PersonCredential;
use App\Models\PersonIdentity;
use App\Services\PersonChecks;
use App\Support\PlatformMode;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Reads an uploaded licence or certificate with Didit document AI, fills in what the person left blank,
 * and verifies it when everything agrees:
 *   - the name on the document matches the person's legal name,
 *   - it hasn't expired,
 *   - it reads as a certificate (a name or an issuer was found),
 *   - the number the person typed, if any, is the number on the document.
 * Certifications (PersonChecks::CERT_TYPES) are verified this way. Driving credentials and check results are read and
 * pre-filled, but an admin still verifies them, since they decide whether a driver can be assigned a load.
 * Anything that doesn't agree goes to an admin with the reason (People → person → Credentials).
 */
class CredentialReader
{
    private const BASE = 'https://verification.didit.me';
    public const NAME_MATCH = 85;

    public static function configured(): bool
    {
        return (new DiditKyb())->configured(PlatformMode::current());
    }

    public static function read(PersonCredential $c): void
    {
        if (!$c->document_path || !self::configured()) return;

        try {
            [$disk, $path] = explode(':', $c->document_path, 2);
            $file = Storage::disk($disk)->get($path);
            if ($file === null) return;

            $fields = [
                ['key' => 'holder_name', 'name' => 'Holder name', 'instruction' => 'Full name of the person the licence or certificate was issued to', 'type' => 'text', 'required' => true],
                ['key' => 'credential_name', 'name' => 'Credential', 'instruction' => 'Name of the licence, card, certificate or course', 'type' => 'text', 'required' => false],
                ['key' => 'issuer', 'name' => 'Issued by', 'instruction' => 'Organisation or agency that issued it', 'type' => 'text', 'required' => false],
                ['key' => 'number', 'name' => 'Number', 'instruction' => 'Certificate, card or licence number', 'type' => 'text', 'required' => false],
                ['key' => 'issued_date', 'name' => 'Issued', 'instruction' => 'Date issued or completed, as YYYY-MM-DD', 'type' => 'date', 'required' => false],
                ['key' => 'expiry_date', 'name' => 'Expires', 'instruction' => 'Expiry or valid-until date, as YYYY-MM-DD; blank if none', 'type' => 'date', 'required' => false],
            ];
            $r = Http::baseUrl(self::BASE)->withHeaders(['x-api-key' => (string) config('services.didit.key')])->acceptJson()->timeout(60)
                ->attach('document', $file, basename($path))
                ->post('/v3/document-ai/', ['fields' => json_encode($fields), 'vendor_data' => "credential-{$c->id}", 'save_api_request' => 'true'])
                ->throw()->json('document_ai') ?? [];

            self::apply($c, (array) ($r['extracted_data'] ?? []));
        } catch (\Throwable $e) {
            Log::warning('[CredentialReader] Document AI failed', ['credential' => $c->id, 'error' => $e->getMessage()]);
            $c->forceFill(['ai_status' => 'error', 'ai_reason' => 'The document could not be read automatically. Shipmater will review it.', 'ai_checked_at' => now()])->saveQuietly();
        }
    }

    /** Apply what was read. Public so it can be tested without calling Didit. */
    public static function apply(PersonCredential $c, array $x): void
    {
        $x = array_map(fn ($v) => is_string($v) ? trim($v) : $v, $x);
        $holder  = (string) ($x['holder_name'] ?? '');
        $expires = self::date($x['expiry_date'] ?? null);
        $issued  = self::date($x['issued_date'] ?? null);
        $number  = (string) ($x['number'] ?? '');

        if ($holder === '' && empty($x['credential_name']) && empty($x['issuer'])) {
            $c->forceFill(['ai_status' => 'unreadable', 'ai_fields' => $x + ['_flags' => ['document']], 'ai_reason' => 'Nothing could be read from the document. Upload a clearer copy, or Shipmater will review it.', 'ai_checked_at' => now()])->saveQuietly();
            return;
        }

        // Fill in what the person left blank
        $default = PersonChecks::CREDENTIAL_LABELS[$c->type] ?? null;
        if ((!$c->name || $c->name === $default) && !empty($x['credential_name'])) $c->name = mb_substr($x['credential_name'], 0, 255);
        if (!$c->issuer && !empty($x['issuer'])) $c->issuer = mb_substr($x['issuer'], 0, 255);
        if (!$c->number && $number !== '') $c->number = mb_substr($number, 0, 100);
        if (!$c->issued_at && $issued) $c->issued_at = $issued;
        if (!$c->expires_at && $expires) $c->expires_at = $expires;

        $score = self::nameScore($holder, self::legalName($c->user_id));
        $problems = [];
        // Which data points need a look (Admin People marks each one)
        $flags = [];
        if ($score < self::NAME_MATCH) $flags[] = 'name';
        if ($expires && ($expires->endOfDay()->isPast() || ($c->expires_at && !$c->expires_at->isSameDay($expires)))) $flags[] = 'expires_at';
        if ($c->number && $number !== '' && self::norm($c->number) !== self::norm($number)) $flags[] = 'number';
        if ($score < self::NAME_MATCH) $problems[] = $holder === '' ? 'No name was found on the document.' : "The name on the document ({$holder}) doesn't match your legal name.";
        if ($expires && $expires->endOfDay()->isPast()) $problems[] = 'The document has expired.';
        if ($c->expires_at && $expires && !$c->expires_at->isSameDay($expires)) $problems[] = 'The expiry date entered differs from the document.';
        if ($c->number && $number !== '' && self::norm($c->number) !== self::norm($number)) $problems[] = 'The number entered differs from the document.';

        $auto = in_array($c->type, PersonChecks::CERT_TYPES, true);
        $ok   = !$problems;

        $c->forceFill([
            'ai_fields' => $x + ['_flags' => $flags], 'ai_name_score' => $score, 'ai_checked_at' => now(),
            'ai_status' => $ok ? 'verified' : 'review',
            'ai_reason' => $ok ? ($auto ? null : 'Read and matched. Shipmater confirms driving credentials before loads are assigned.') : implode(' ', $problems),
        ]);
        if ($ok && $auto) {
            $c->forceFill(['verified_at' => now(), 'verified_by' => null, 'verification_method' => 'document_ai']);
        }
        $c->saveQuietly();

        if ($ok && $auto && $c->user) PersonChecks::refresh($c->user);
    }

    private static function legalName(int $userId): string
    {
        $i = PersonIdentity::where('user_id', $userId)->first();
        $legal = trim(($i?->legal_first_name ?? '') . ' ' . ($i?->legal_last_name ?? ''));
        return $legal !== '' ? $legal : (string) \App\Models\User::where('id', $userId)->value('name');
    }

    /** 0–100: how well the name on the document matches the person, ignoring order, case, punctuation and middle names */
    public static function nameScore(string $onDoc, string $person): int
    {
        $tokens = fn (string $s) => array_values(array_filter(preg_split('/\s+/', preg_replace('/[^a-z ]/', ' ', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', $s) ?: $s)))));
        $doc = $tokens($onDoc);
        $me  = $tokens($person);
        if (!$doc || !$me) return 0;
        // First and last name must both be on the document; extra names (middle) are fine
        $first = $me[0]; $last = end($me);
        $has = fn (string $t) => (bool) array_filter($doc, fn ($d) => $d === $t || levenshtein($d, $t) <= (strlen($t) > 5 ? 1 : 0));
        $hits = ($has($first) ? 1 : 0) + ($has($last) ? 1 : 0);
        if ($hits === 2) return 100;
        similar_text(implode(' ', $doc), implode(' ', $me), $pct);
        return (int) min(round($pct), $hits === 1 ? 70 : 50);
    }

    private static function norm(string $s): string { return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $s)); }

    private static function date(mixed $v): ?\Illuminate\Support\Carbon
    {
        if (!is_string($v) || $v === '') return null;
        try { return \Illuminate\Support\Carbon::parse($v)->startOfDay(); } catch (\Throwable) { return null; }
    }
}
