<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Integrations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Admin, Integrations: every outside service, whether its keys are set (never the values), and a connection test */
class AdminIntegrationsController extends Controller
{
    // GET /api/v1/admin/integrations
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        return response()->json(['data' => Integrations::all(), 'environment' => app()->environment()]);
    }

    // POST /api/v1/admin/integrations/{key}/test
    public function test(Request $request, string $key): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        try {
            return response()->json(['ok' => true, 'message' => Integrations::test($key)]);
        } catch (\Illuminate\Http\Client\RequestException $e) {
            // The provider's own reason, when it gives one
            $r = $e->response;
            $why = $r->json('detail') ?? $r->json('message') ?? $r->json('error.message') ?? $r->json('error') ?? null;
            return response()->json(['ok' => false, 'message' => "Refused ({$r->status()})" . (is_string($why) ? ": {$why}" : '')]);
        } catch (\Throwable $e) {
            // Error bodies can be long; keep the first line
            return response()->json(['ok' => false, 'message' => mb_substr(strtok($e->getMessage(), "\n") ?: 'Failed', 0, 300)]);
        }
    }
}
