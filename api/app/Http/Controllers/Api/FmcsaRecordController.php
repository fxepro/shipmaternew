<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrgCheck;
use App\Services\FmcsaOpenData;
use App\Services\PersonChecks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /api/v1/company/fmcsa-record: what FMCSA's public data holds on the signed-in carrier or broker */
class FmcsaRecordController extends Controller
{
    public function show(Request $request, FmcsaOpenData $data): JsonResponse
    {
        $org = PersonChecks::companyOf($request->user(), ['carrier', 'broker']);
        abort_unless($org, 404, 'Only carriers and brokers have an FMCSA record.');

        [$dot, $mc] = $org->type === 'carrier'
            ? [$org->carrier_dot_number, $org->carrier_mc_number]
            : [OrgCheck::for($org, 'fmcsa_broker')?->external_id, $org->fmcsa_broker_mc];

        return response()->json(['data' => $data->record($dot, $mc, $request->boolean('fresh')), 'dot' => $dot, 'mc' => $mc]);
    }
}
