<?php

namespace App\Services\Background;

use App\Models\BackgroundCheck;
use App\Models\DocumentDownload;
use App\Models\PersonCredential;
use App\Models\PersonIdentity;
use App\Models\User;
use App\Notifications\CheckReportNotification;
use App\Services\PersonChecks;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * The PDFs a finished check comes with:
 *   summary: Shipmater's one-page summary of the result (always, once the check has finished)
 *   report:  the provider's full consumer report, kept privately once fetched
 * Who may download: the person; the carrier owner who manages them; the shipper company that paid for the check;
 * platform admins. Every download is logged in document_downloads.
 */
class CheckReports
{
    public const INCLUDES = [
        'basic'    => ['Criminal record search (national and federal)', 'Sex offender registry', 'OFAC and global watchlists'],
        'complete' => ['County criminal records', 'Motor vehicle record (MVR, with CDLIS)', 'FMCSA Drug & Alcohol Clearinghouse query'],
    ];
    public const RESULT = ['clear' => 'Passed', 'consider' => 'Needs review', 'suspended' => 'Not passed'];

    public static function canDownload(User $actor, BackgroundCheck $check): bool
    {
        if ($actor->isPlatformAdmin()) return true;
        $subject = $check->user;
        if (!$subject) return false;
        if (BackgroundChecks::canManage($actor, $subject)) return true;
        return $check->paid_by === 'shipper' && $check->payer_id && $actor->current_org_id === $check->payer_id;
    }

    public static function log(User $actor, BackgroundCheck $check, string $kind, ?string $ip): void
    {
        DocumentDownload::create(['user_id' => $actor->id, 'subject_user_id' => $check->user_id, 'kind' => $kind,
            'ref_type' => 'background_check', 'ref_id' => $check->id, 'ip' => $ip]);
    }

    public static function filename(BackgroundCheck $check, string $type): string
    {
        $name = preg_replace('/[^A-Za-z0-9]+/', '-', (string) $check->user?->name) ?: 'person';
        $level = $check->coversComplete() ? 'complete' : 'basic';
        return trim("{$name}-{$level}-check-" . ($type === 'report' ? 'full-report' : 'summary') . '-' . $check->completed_at?->format('Y-m-d'), '-') . '.pdf';
    }

    /** Shipmater's summary of the check */
    public static function summaryPdf(BackgroundCheck $check): string
    {
        $user = $check->user;
        $identity = PersonIdentity::where('user_id', $user->id)->first();
        $clearinghouse = PersonCredential::where('user_id', $user->id)->where('type', 'clearinghouse')->latest('id')->first();
        $level = $check->coversComplete() ? 'complete' : 'basic';
        $includes = $level === 'complete' ? [...self::INCLUDES['basic'], ...self::INCLUDES['complete']] : self::INCLUDES['basic'];

        return Pdf::loadView('checks.summary', [
            'check' => $check, 'user' => $user, 'level' => $level, 'includes' => $includes,
            'result' => self::RESULT[$check->status] ?? ucfirst($check->status),
            'provider' => match ($check->provider) { 'checkr' => 'Checkr, Inc.', 'foley' => 'Foley Services', 'fake' => 'Test provider (not a real check)', default => $check->provider },
            'identity' => $identity?->status === 'verified' ? 'Verified' . ($identity->verified_at ? ' on ' . $identity->verified_at->format('M j, Y') : '') : 'Not verified',
            'clearinghouse' => $clearinghouse ? (PersonChecks::credentialState($clearinghouse) === 'met' ? 'Clear' : ucfirst(str_replace('_', ' ', (string) ($clearinghouse->result ?? 'pending')))) . ($clearinghouse->issued_at ? ' (' . $clearinghouse->issued_at->format('M j, Y') . ')' : '') : null,
            'payer' => $check->paid_by === 'shipper' ? $check->payerOrg?->name : null,
            'generated' => now(),
        ])->setPaper('letter')->setWarnings(false)->output();
    }

    /** The provider's full report: from storage, or fetched and stored now. null when the provider has none. */
    public static function reportPdf(BackgroundCheck $check): ?string
    {
        if ($check->report_pdf_path && str_contains($check->report_pdf_path, ':')) {
            [$disk, $path] = explode(':', $check->report_pdf_path, 2);
            if (Storage::disk($disk)->exists($path)) return Storage::disk($disk)->get($path);
        }
        if (!$check->report_id || !$check->isFinished()) return null;

        try {
            $bytes = BackgroundChecks::provider($check->provider)->reportPdf($check->report_id, $check->mode ?? 'test');
        } catch (\Throwable $e) {
            Log::warning('[CheckReports] Report PDF fetch failed', ['check' => $check->id, 'error' => $e->getMessage()]);
            return null;
        }
        if (!$bytes || !str_starts_with($bytes, '%PDF')) return null;

        $r2   = config('filesystems.disks.r2');
        $disk = !empty($r2['key']) && !empty($r2['bucket']) ? 'r2' : 'local';
        $path = "people/{$check->user_id}/checks/report_{$check->id}.pdf";
        Storage::disk($disk)->put($path, $bytes);
        $check->forceFill(['report_pdf_path' => "{$disk}:{$path}", 'report_pdf_at' => now()])->saveQuietly();

        return $bytes;
    }

    /** True when a full report can be offered: stored, or the provider gives one */
    public static function hasReport(BackgroundCheck $check): bool
    {
        return $check->isFinished() && ($check->report_pdf_path !== null || in_array($check->provider, ['checkr', 'fake'], true) && $check->report_id);
    }

    /** When a check finishes: keep the provider's PDF, and email the person with the summary attached */
    public static function finished(BackgroundCheck $check): void
    {
        self::reportPdf($check);
        if ($check->user) {
            try {
                $check->user->notify(new CheckReportNotification($check->fresh()));
                DocumentDownload::create(['user_id' => null, 'subject_user_id' => $check->user_id, 'kind' => 'check_email',
                    'ref_type' => 'background_check', 'ref_id' => $check->id, 'ip' => null]);
            } catch (\Throwable $e) {
                Log::warning('[CheckReports] Email failed', ['check' => $check->id, 'error' => $e->getMessage()]);
            }
        }
    }
}
