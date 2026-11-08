<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\AdminCompanyController;
use App\Models\Organization;
use Illuminate\Console\Command;

/**
 * Deferred checks (Admin Console, Compliance): an approved company with a deferred check past its due date
 * is restricted; once everything overdue has passed it goes back to approved.
 */
class EnforceComplianceDeadlines extends Command
{
    protected $signature = 'compliance:enforce-deadlines';
    protected $description = 'Restrict approved companies whose deferred checks are overdue, and lift it when they catch up';

    public function handle(): int
    {
        $ctrl = app(AdminCompanyController::class);
        $restricted = 0; $lifted = 0;

        Organization::whereIn('verification_status', ['approved', 'restricted'])->whereNotNull('owner_id')
            ->with(['owner', 'orgMembers.user.personVerification'])->chunkById(200, function ($orgs) use ($ctrl, &$restricted, &$lifted) {
                foreach ($orgs as $org) {
                    $overdue = collect($ctrl->approvalChecklist($org, $org->type === 'carrier'))->where('overdue', true)->pluck('label');
                    if ($overdue->isNotEmpty() && $org->verification_status === 'approved') {
                        $org->update(['verification_status' => 'restricted', 'verification_updated_at' => now(), 'verification_updated_by' => null,
                            'verification_notes' => 'Restricted automatically: overdue ' . $overdue->implode(', ') . '.']);
                        $restricted++;
                    } elseif ($overdue->isEmpty() && $org->verification_status === 'restricted') {
                        $org->update(['verification_status' => 'approved', 'verification_updated_at' => now(), 'verification_updated_by' => null,
                            'verification_notes' => 'Restriction lifted automatically: overdue checks passed.']);
                        $lifted++;
                    }
                }
            });

        $this->info("Restricted {$restricted}, lifted {$lifted}.");
        return self::SUCCESS;
    }
}
