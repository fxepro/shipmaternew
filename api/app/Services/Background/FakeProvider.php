<?php

namespace App\Services\Background;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Stand-in provider for local testing, never offered in production. Its "form" is a signed API link
 * (GET /background/fake/{check}) that finishes the check with the result in the link.
 */
class FakeProvider implements Provider
{
    public function name(): string { return 'fake'; }

    public function configured(string $mode): bool
    {
        return !app()->environment('production');
    }

    public function createCandidate(array $person, string $mode): string
    {
        return 'fake_cand_' . Str::random(12);
    }

    public function invite(string $candidateId, string $package, ?string $state, string $mode): array
    {
        // The URL needs the check id, which BackgroundChecks fills in once the row exists
        return ['id' => 'fake_inv_' . Str::random(12), 'url' => ''];
    }

    public function parseWebhook(Request $request): ?array
    {
        return null;
    }

    /** A sample report, so downloads can be built and tested without a real provider */
    public function reportPdf(string $reportId, string $mode): ?string
    {
        $check = \App\Models\BackgroundCheck::where('report_id', $reportId)->first();
        return \Barryvdh\DomPDF\Facade\Pdf::loadView('checks.fake_report', ['check' => $check, 'reportId' => $reportId])
            ->setPaper('letter')->setWarnings(false)->output();
    }

    public function testConnection(string $mode): string
    {
        return 'Test provider: checks finish from the link on the person\'s form, with no outside service.';
    }
}
