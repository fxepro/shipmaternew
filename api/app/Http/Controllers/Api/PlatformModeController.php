<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\KybCountries;
use App\Support\PlatformMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The one Test / Live switch for outside checks (App\Support\PlatformMode) */
class PlatformModeController extends Controller
{
    // GET /api/v1/admin/settings/mode
    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        return response()->json(['data' => $this->payload()]);
    }

    // PUT /api/v1/admin/settings/mode   { mode: test|live }
    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $mode = $request->validate(['mode' => ['required', 'in:test,live']])['mode'];
        if ($mode === 'live') {
            if (!PlatformMode::liveAllowed()) return response()->json(['message' => 'Live mode is turned off on this computer. Use it on the live site only.'], 422);
            $missing = collect(PlatformMode::services())->where('switch', true)->where('live_ready', false)->pluck('name');
            if ($missing->isNotEmpty()) return response()->json(['message' => 'Add the live keys to the server first: ' . $missing->implode(', ') . '.'], 422);
        }
        PlatformMode::save($mode, $request->user()->id);
        return response()->json(['data' => $this->payload()]);
    }

    // GET /api/v1/kyb/countries   the countries a company can be verified in (company profile)
    public function countries(): JsonResponse
    {
        return response()->json(['data' => KybCountries::enabled()]);
    }

    private function payload(): array
    {
        return ['mode' => PlatformMode::current(), 'stored' => PlatformMode::stored(), 'live_allowed' => PlatformMode::liveAllowed(), 'services' => PlatformMode::services()];
    }
}
