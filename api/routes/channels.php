<?php

use App\Models\FreightJob;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Private channel: load.{id} (a freight job)
// Authorized for: anyone in the shipper or carrier company, a person on the load, a company with a stop on it
// (such as the receiver), and platform admins
Broadcast::channel('load.{jobId}', function (User $user, int $jobId) {
    $job = FreightJob::find($jobId);
    if (!$job) return false;

    return $user->isPlatformAdmin()
        || $user->isShipperOf($job)
        || $user->isCarrierOf($job)
        || $job->people()->where('user_id', $user->id)->exists()
        || ($user->current_org_id && $job->stops()->whereIn('location_id',
                \App\Models\Location::where('org_id', $user->current_org_id)->select('id'))->exists());
});
