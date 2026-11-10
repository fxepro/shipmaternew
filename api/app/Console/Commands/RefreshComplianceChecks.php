<?php

namespace App\Console\Commands;

use App\Models\CarrierVerification;
use App\Models\OrgCheck;
use App\Models\Organization;
use App\Services\Checks\RegistryChecks;
use App\Services\FmcsaService;
use Illuminate\Console\Command;

/**
 * Daily: look companies up again in the public registers so a lapsed authority, bond, insurance filing
 * or SAM registration shows (demo/compliance-checks.html). KYB results are not re-run here.
 */
class RefreshComplianceChecks extends Command
{
    protected $signature = 'compliance:refresh-checks {--days=7 : Re-check anything older than this}';
    protected $description = 'Re-check FMCSA (carriers and brokers) and SAM.gov for companies not checked recently';

    public function handle(FmcsaService $fmcsa): int
    {
        $before = now()->subDays((int) $this->option('days'));
        $n = 0;

        // Carriers: USDOT status and the insurance filing
        $carriers = Organization::where('type', 'carrier')->whereNotNull('owner_id')->whereNotNull('carrier_dot_number')
            ->where(fn ($q) => $q->whereNull('carrier_last_verification_at')->orWhere('carrier_last_verification_at', '<', $before))->get();
        foreach ($carriers as $o) {
            $r = $fmcsa->lookupByDot($o->carrier_dot_number);
            if (!$r) continue;
            $o->update(['carrier_dot_verified' => $r['allowed_to_operate'], 'carrier_last_verification_at' => now()]);
            CarrierVerification::updateOrCreate(['carrier_id' => $o->id, 'check_type' => 'fmcsa'], [
                'status' => $r['allowed_to_operate'] ? 'passed' : 'failed', 'external_id' => $r['dot_number'], 'result_data' => $r, 'expires_at' => now()->addDays(90),
            ]);
            $n++;
        }

        // Brokers: authority and bond. Shippers: SAM.gov.
        foreach (Organization::where('type', 'broker')->whereNotNull('owner_id')->whereNotNull('fmcsa_broker_mc')->get() as $o) {
            $last = OrgCheck::for($o, 'fmcsa_broker');
            if ($last && $last->requested_at > $before) continue;
            RegistryChecks::fmcsaBroker($o); $n++;
        }
        foreach (Organization::whereNotNull('owner_id')->whereNotNull('sam_gov_number')->get() as $o) {
            $last = OrgCheck::for($o, 'sam_gov');
            if ($last && $last->requested_at > $before) continue;
            RegistryChecks::samGov($o); $n++;
        }

        // Didit registry data still being fetched: read the decision again
        foreach (OrgCheck::where('check', 'kyb')->where('provider', 'didit')->where('status', 'pending')->whereNotNull('external_id')->get() as $c) {
            \App\Services\Checks\Kyb::refresh('didit', $c->external_id); $n++;
        }

        $this->info("{$n} companies checked again.");
        return self::SUCCESS;
    }
}
