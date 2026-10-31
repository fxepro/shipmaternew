<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\OrgRemittance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The current company's remittance details (Account → Finance). Owner and Staff can edit. */
class OrgRemittanceController extends Controller
{
    // GET /api/v1/org/remittance
    public function show(Request $request): JsonResponse
    {
        $org = $request->user()->currentOrg;
        abort_if(!$org, 404);

        return response()->json(['data' => $this->present(OrgRemittance::firstWhere('org_id', $org->id))]);
    }

    // PUT /api/v1/org/remittance   (blank account_number keeps the stored one)
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $org  = $user->currentOrg;
        abort_if(!$org, 404);
        abort_unless($user->isOrgAdmin(), 403);

        $data = $request->validate([
            'payee_name'          => ['nullable', 'string', 'max:255'],
            'bank_name'           => ['nullable', 'string', 'max:255'],
            'routing_number'      => ['nullable', 'digits:9'],
            'account_number'      => ['nullable', 'regex:/^\d{4,17}$/'],
            'account_type'        => ['nullable', 'in:checking,savings'],
            'wire_routing_number' => ['nullable', 'digits:9'],
            'check_payable_to'    => ['nullable', 'string', 'max:255'],
            'check_street'        => ['nullable', 'string', 'max:255'],
            'check_city'          => ['nullable', 'string', 'max:120'],
            'check_state'         => ['nullable', 'string', 'max:60'],
            'check_zip'           => ['nullable', 'string', 'max:20'],
            'remittance_email'    => ['nullable', 'email', 'max:255'],
            'remittance_phone'    => ['nullable', 'string', 'max:40'],
            'instructions'        => ['nullable', 'string', 'max:2000'],
            'billing_name'        => ['nullable', 'string', 'max:255'],
            'billing_email'       => ['nullable', 'email', 'max:255'],
            'billing_phone'       => ['nullable', 'string', 'max:40'],
        ], [
            'account_number.regex' => 'Enter the account number as 4 to 17 digits.',
        ]);

        if (empty($data['account_number'])) unset($data['account_number']);

        $remittance = OrgRemittance::firstOrNew(['org_id' => $org->id]);
        $remittance->fill($data + ['updated_by' => $user->id])->save();

        return response()->json(['data' => $this->present($remittance->fresh())]);
    }

    /** The full account number never leaves the server here; only its last 4. */
    private function present(?OrgRemittance $r): array
    {
        $fields = (new OrgRemittance)->getFillable();
        $out = [];
        foreach ($fields as $f) {
            if (in_array($f, ['org_id', 'account_number', 'updated_by'], true)) continue;
            $out[$f] = $r?->{$f};
        }
        $out['account_last4'] = $r?->account_last4;
        $out['updated_at']    = $r?->updated_at?->toISOString();

        return $out;
    }
}
