<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BackgroundCheck;
use App\Models\User;
use App\Services\Background\BackgroundChecks;
use App\Services\Background\CheckReports;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\StripeClient;

/**
 * Background checks (App\Services\Background\BackgroundChecks): paying for them, starting them, provider webhooks,
 * the contracted shipper's view, and the admin settings.
 */
class BackgroundCheckController extends Controller
{
    private function stripe(): StripeClient
    {
        return new StripeClient(config('services.stripe.secret'));
    }

    /** The person a request is about: ?user_id= for an owner managing a driver, otherwise the signed-in user */
    private function subject(Request $request): User
    {
        $actor = $request->user();
        $id = (int) $request->input('user_id', 0);
        if (!$id || $id === $actor->id) return $actor;

        $subject = User::findOrFail($id);
        abort_unless(BackgroundChecks::canManage($actor, $subject), 403);
        return $subject;
    }

    // GET /api/v1/background?user_id=
    public function show(Request $request): JsonResponse
    {
        $subject = $this->subject($request);
        return response()->json(['data' => [...BackgroundChecks::summary($subject), 'prices' => BackgroundChecks::prices()]]);
    }

    // POST /api/v1/background/pay   { level: basic|complete, user_id? }  → { client_secret, amount }
    public function pay(Request $request): JsonResponse
    {
        $data    = $request->validate(['level' => ['required', 'in:basic,complete']]);
        $subject = $this->subject($request);
        $summary = BackgroundChecks::summary($subject, false);

        $open = fn (?array $c) => $c && in_array($c['status'], ['paid', 'invitation_sent', 'pending', 'expired'], true);
        if ($data['level'] === 'basic' && ($summary['level'] || $open($summary['basic']) || in_array($summary['basic']['status'] ?? null, ['clear', 'consider'], true))) {
            return response()->json(['error' => 'The basic background check is already paid for.'], 422);
        }
        if ($data['level'] === 'complete' && ($summary['level'] === 'complete' || $open($summary['complete']))) {
            return response()->json(['error' => 'A complete background check is already paid for.'], 422);
        }

        $kind = BackgroundChecks::nextKind($subject, $data['level']);
        return $this->intent($request, [$subject], $data['level'], 'carrier', BackgroundChecks::priceCents($kind),
            $data['level'] === 'complete' ? 'Shipmater complete background check' : 'Shipmater background check');
    }

    // POST /api/v1/background/checks/{check}/start   — a paid check that couldn't start, or one whose form expired
    public function start(Request $request, BackgroundCheck $check): JsonResponse
    {
        abort_unless(BackgroundChecks::canManage($request->user(), $check->user), 403);
        try {
            $check = BackgroundChecks::start($check);
        } catch (\RuntimeException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
        return response()->json(['invitation_url' => $check->invitation_url, 'message' => 'Background check started. Complete the secure form.']);
    }

    // ── Shippers: complete checks for carriers they have a contract with ────

    /** {carrier} is the carrier company (organizations.id) */
    private function contractedCarrier(Request $request, int $carrier): \App\Models\Organization
    {
        abort_unless($request->user()->postsLoads(), 403);
        $org = \App\Models\Organization::where('type', 'carrier')->find($carrier);
        abort_unless($org, 404, 'This carrier has no company on Shipmater.');
        abort_unless(BackgroundChecks::shipperHasContract($request->user(), $org), 403, 'Background check results are shared only with shippers that have an active contract with this carrier.');
        return $org;
    }

    /** People at the carrier who aren't complete and have nothing complete in progress, with each one's price */
    private function toUpgrade(\App\Models\Organization $org): array
    {
        return BackgroundChecks::people($org)->map(function ($u) {
            $s = BackgroundChecks::summary($u, false);
            $busy = in_array($s['complete']['status'] ?? null, ['paid', 'invitation_sent', 'pending'], true);
            return ($s['level'] === 'complete' || $busy) ? null : ['user' => $u, 'cents' => BackgroundChecks::priceCents($s['next_complete_kind'])];
        })->filter()->values()->all();
    }

    // GET /api/v1/shipper/carriers/{carrier}/background
    public function shipperShow(Request $request, int $carrier): JsonResponse
    {
        $org = $this->contractedCarrier($request, $carrier);
        $todo = $this->toUpgrade($org);

        return response()->json(['data' => [
            'carrier_level' => BackgroundChecks::carrierLevel($org),
            'people'        => BackgroundChecks::people($org)->map(fn ($u) => BackgroundChecks::summary($u, false))->values(),
            'order'         => ['people' => count($todo), 'amount' => array_sum(array_column($todo, 'cents')) / 100],
        ]]);
    }

    // POST /api/v1/shipper/carriers/{carrier}/background   → { client_secret, amount }
    public function shipperOrder(Request $request, int $carrier): JsonResponse
    {
        $org  = $this->contractedCarrier($request, $carrier);
        $todo = $this->toUpgrade($org);
        if (!$todo) {
            return response()->json(['error' => 'Everyone at this carrier already has a complete check or one in progress.'], 422);
        }
        return $this->intent($request, array_column($todo, 'user'), 'complete', 'shipper', array_sum(array_column($todo, 'cents')),
            'Shipmater complete background check for ' . ($org->name ?? 'a carrier'));
    }

    private function intent(Request $request, array $subjects, string $level, string $paidBy, int $amountCents, string $description): JsonResponse
    {
        if ($amountCents < 50) {
            return response()->json(['error' => 'Background check prices aren\'t set. Contact Shipmater support.'], 422);
        }
        $payer  = $request->user();
        $intent = $this->stripe()->paymentIntents->create([
            'amount'                    => $amountCents,
            'currency'                  => 'usd',
            'automatic_payment_methods' => ['enabled' => true],
            'description'               => $description,
            'metadata'                  => [
                'type'          => 'background_check',
                'level'         => $level,
                'subjects'      => implode(',', array_map(fn ($u) => $u->id, $subjects)),
                'paid_by'       => $paidBy,
                'payer_user_id' => (string) $payer->id,
                'payer_id'      => (string) ($payer->current_org_id ?? ''),
            ],
        ]);
        return response()->json(['client_secret' => $intent->client_secret, 'amount' => $amountCents / 100]);
    }

    // ── Provider webhooks (public, signed by the provider) ───────────────────

    // POST /api/v1/background/webhook/{provider}   (and the older /api/v1/checkr/webhook)
    public function webhook(Request $request, string $provider = 'checkr'): JsonResponse
    {
        abort_unless(in_array($provider, ['checkr', 'foley'], true), 404);
        $event = BackgroundChecks::provider($provider)->parseWebhook($request);
        if ($event === null) return response()->json(['error' => 'Invalid signature'], 401);
        if ($event) BackgroundChecks::handle($provider, $event);
        return response()->json(['received' => true]);
    }

    // GET /api/v1/background/fake/{check}?result=clear|consider   — the test provider's "form" (signed link, never in production)
    public function fake(Request $request, BackgroundCheck $check)
    {
        abort_if(app()->environment('production') || $check->provider !== 'fake', 404);
        $result = $request->query('result', 'clear') === 'consider' ? 'consider' : 'clear';
        BackgroundChecks::handle('fake', ['event' => 'invitation_completed', 'invitation_id' => $check->invitation_id]);
        BackgroundChecks::handle('fake', ['event' => 'report_completed', 'invitation_id' => $check->invitation_id, 'report_id' => "fake_rep_{$check->id}", 'result' => $result]);
        return redirect(config('app.frontend_url') . '/carrier/profile?tab=background');
    }

    // GET /api/v1/background/checks/{check}/pdf/{type}   type: summary | report
    public function pdf(Request $request, BackgroundCheck $check, string $type)
    {
        abort_unless(in_array($type, ['summary', 'report'], true), 404);
        abort_unless(CheckReports::canDownload($request->user(), $check), 403);
        abort_unless($check->isFinished(), 422, 'PDFs are available once the check is finished.');

        $bytes = $type === 'summary' ? CheckReports::summaryPdf($check) : CheckReports::reportPdf($check);
        abort_if($bytes === null, 404, "The screening company hasn't made the full report available yet. Try again later.");

        CheckReports::log($request->user(), $check, "check_{$type}", $request->ip());
        return response($bytes, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . CheckReports::filename($check, $type) . '"',
            'Cache-Control'       => 'no-store',
        ]);
    }

    // POST /api/v1/background/checks/{check}/email   Emails the summary to the signed-in person's own address
    public function email(Request $request, BackgroundCheck $check): JsonResponse
    {
        $actor = $request->user();
        abort_unless(CheckReports::canDownload($actor, $check), 403);
        abort_unless($check->isFinished(), 422, 'PDFs are available once the check is finished.');

        try {
            $actor->notify(new \App\Notifications\CheckReportNotification($check));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('[CheckReports] Email failed', ['check' => $check->id, 'error' => $e->getMessage()]);
            return response()->json(['error' => 'The email could not be sent right now. Download the PDF instead, or try again later.'], 503);
        }
        CheckReports::log($actor, $check, 'check_email', $request->ip());
        return response()->json(['message' => "Sent to {$actor->email}."]);
    }

    // ── Admin → Settings → Background checks ─────────────────────────────────

    // GET /api/v1/admin/settings/background
    public function settings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        return response()->json(['data' => $this->settingsPayload()]);
    }

    // PUT /api/v1/admin/settings/background
    public function updateSettings(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate([
            'provider'              => ['required', 'in:' . implode(',', BackgroundChecks::PROVIDERS)],
            'packages'              => ['required', 'array'],
            'packages.*.basic'      => ['nullable', 'string', 'max:100'],
            'packages.*.full'       => ['nullable', 'string', 'max:100'],
            'packages.*.upgrade'    => ['nullable', 'string', 'max:100'],
        ]);
        if ($data['provider'] === 'fake' && app()->environment('production')) {
            return response()->json(['message' => 'The test provider isn\'t available in production.'], 422);
        }
        // Test / Live is the platform switch (App\Support\PlatformMode)
        if (BackgroundChecks::mode() === 'live' && !BackgroundChecks::provider($data['provider'])->configured('live')) {
            return response()->json(['message' => 'Add the provider\'s live key to the server before switching to live mode.'], 422);
        }

        $packages = [];
        foreach (BackgroundChecks::PROVIDERS as $p) {
            foreach (['basic', 'full', 'upgrade'] as $k) $packages[$p][$k] = trim((string) ($data['packages'][$p][$k] ?? ''));
        }
        BackgroundChecks::save(['provider' => $data['provider'], 'packages' => $packages], $request->user()->id);

        return response()->json(['data' => $this->settingsPayload()]);
    }

    // POST /api/v1/admin/settings/background/test   { provider }
    public function testConnection(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $data = $request->validate(['provider' => ['required', 'in:' . implode(',', BackgroundChecks::PROVIDERS)]]);
        try {
            return response()->json(['ok' => true, 'message' => BackgroundChecks::provider($data['provider'])->testConnection(BackgroundChecks::mode())]);
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()]);
        }
    }

    private function settingsPayload(): array
    {
        $s = BackgroundChecks::settings();
        $base = rtrim(config('app.url'), '/') . '/api/v1/background/webhook/';
        $providers = collect(BackgroundChecks::PROVIDERS)
            ->reject(fn ($p) => $p === 'fake' && app()->environment('production'))
            ->map(fn ($p) => [
                'key'        => $p,
                'name'       => ['checkr' => 'Checkr', 'foley' => 'Foley', 'fake' => 'Test provider (no outside service)'][$p],
                'test_ready' => BackgroundChecks::provider($p)->configured('test'),
                'live_ready' => BackgroundChecks::provider($p)->configured('live'),
                'webhook'    => $p === 'fake' ? null : $base . $p,
                'connected'  => $p !== 'foley',
            ])->values();

        return [...$s, 'providers' => $providers, 'live_allowed' => BackgroundChecks::liveAllowed(), 'prices' => BackgroundChecks::prices()];
    }
}
