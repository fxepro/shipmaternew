<?php

namespace Database\Seeders;

use App\Models\FactoredLoad;
use App\Models\Noa;
use App\Models\Organization;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

/**
 * Demo NOAs and factored loads with Summit Freight Capital (dana@demo.com):
 * - Jordan's carrier: active NOA, loads in every state (requested, accepted, funded, declined), one left to factor
 * - Marcus's carrier: NOA waiting for Summit to confirm
 * Skips any carrier that already has an NOA, so it is safe to run again.
 */
class FactoringDemoSeeder extends Seeder
{
    public function run(): void
    {
        $dana   = User::where('email', 'dana@demo.com')->first();
        $factor = $dana ? Organization::where('owner_id', $dana->id)->where('type', 'factor')->first() : null;
        if (!$factor) return;

        $jordan = User::where('email', 'jordan@demo.com')->first();
        $marcus = User::where('email', 'marcus@demo.com')->first();
        $alex   = User::where('email', 'alex@demo.com')->first();

        // Sample NOA document on the local disk (demo data never goes to R2)
        $doc = 'demo/noa-sample.pdf';
        if (!Storage::disk('local')->exists($doc)) {
            Storage::disk('local')->put($doc, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
        }

        if ($jordan && ($carrier = $this->carrierOrg($jordan)) && !Noa::where('carrier_org_id', $carrier->id)->exists()) {
            $noa = Noa::create([
                'carrier_org_id' => $carrier->id,
                'factor_org_id'  => $factor->id,
                'status'         => 'active',
                'effective_date' => today()->subDays(14),
                'document_path'  => "local:{$doc}",
                'notes'          => 'Signed NOA, all receivables to Summit.',
                'uploaded_by'    => $jordan->id,
                'decided_by'     => $dana->id,
                'decided_at'     => now()->subDays(13),
            ]);

            $shipments = Shipment::where('carrier_id', $jordan->id)->orderBy('id')->get()->keyBy('item_description');
            $loads = [
                ['Pallet of surgical instruments', 'accepted', ['shipper_acknowledged_at' => now()->subDays(2), 'shipper_acknowledged_by' => $alex?->id]],
                ['Restaurant kitchen equipment',   'requested', []],
                ['Film production equipment',      'declined', ['decline_reason' => 'Shipper credit limit reached']],
                ['Art gallery installation',       'funded',   ['funded_at' => now()->subDays(5), 'funded_by' => $dana->id]],
            ];
            foreach ($loads as [$title, $status, $extra]) {
                $s = $shipments->get($title);
                if (!$s) continue;
                FactoredLoad::create([
                    'noa_id'         => $noa->id,
                    'carrier_org_id' => $carrier->id,
                    'factor_org_id'  => $factor->id,
                    'load_type'      => 'shipment',
                    'load_id'        => $s->id,
                    'load_amount'    => $s->agreed_cost,
                    'status'         => $status,
                    'requested_by'   => $jordan->id,
                    'decided_by'     => $status === 'requested' ? null : $dana->id,
                    'decided_at'     => $status === 'requested' ? null : now()->subDays(6),
                ] + $extra);
            }
        }

        if ($marcus && ($carrier = $this->carrierOrg($marcus)) && !Noa::where('carrier_org_id', $carrier->id)->exists()) {
            Noa::create([
                'carrier_org_id' => $carrier->id,
                'factor_org_id'  => $factor->id,
                'status'         => 'pending_factor',
                'effective_date' => today(),
                'document_path'  => "local:{$doc}",
                'notes'          => 'Starting with Summit this week.',
                'uploaded_by'    => $marcus->id,
            ]);
        }
    }

    private function carrierOrg(User $u): ?Organization
    {
        return Organization::where('owner_id', $u->id)->where('type', 'carrier')->first();
    }
}
