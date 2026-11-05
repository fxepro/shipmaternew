<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CarrierProfile;
use App\Models\FreightJob;
use App\Models\Organization;
use App\Models\Rating;
use App\Models\ShipperProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RatingController extends Controller
{
    // POST /api/v1/jobs/{job}/ratings
    public function store(Request $request, FreightJob $job): JsonResponse
    {
        $user = $request->user();

        // Job must be completed
        if ($job->status !== 'completed') {
            return response()->json(['message' => 'You can only leave a review after the job is completed.'], 422);
        }

        // The person's company must be the shipper or the carrier on this job
        $isShipper = $user->isShipperOf($job);
        $isCarrier = $user->isCarrierOf($job);

        if (! $isShipper && ! $isCarrier) {
            return response()->json(['message' => 'You are not a party to this job.'], 403);
        }

        // One rating per job per rating company
        if (Rating::where('freight_job_id', $job->id)->where('rater_id', $user->current_org_id)->exists()) {
            return response()->json(['message' => 'Your company has already reviewed this job.'], 422);
        }

        $data = $request->validate([
            'overall'       => ['required', 'integer', 'min:1', 'max:5'],
            'communication' => ['required', 'integer', 'min:1', 'max:5'],
            'reliability'   => ['required', 'integer', 'min:1', 'max:5'],
            'comment'       => ['nullable', 'string', 'max:1000'],
        ]);

        // Company rates company; user_id is the person who wrote it
        $raterType   = $isShipper ? 'shipper' : 'carrier';
        $rateeOrgId  = $isShipper ? $job->carrier_id : $job->shipper_id;

        $rating = Rating::create(array_merge($data, [
            'freight_job_id' => $job->id,
            'user_id'        => $user->id,
            'rater_id'       => $user->current_org_id,
            'ratee_id'       => $rateeOrgId,
            'rater_type'     => $raterType,
            'is_public'      => true,
        ]));

        // Recalculate avg rating on the ratee's profile
        $this->recalculate($raterType, $rateeOrgId);

        return response()->json(['data' => $this->format($rating)], 201);
    }

    // GET /api/v1/jobs/{job}/ratings
    public function jobRatings(Request $request, FreightJob $job): JsonResponse
    {
        $ratings = $job->ratings()->with(['raterOrg'])->get()->map(fn ($r) => $this->format($r));
        return response()->json(['data' => $ratings]);
    }

    // GET /api/v1/orgs/{org}/ratings
    public function profileRatings(Request $request, Organization $org): JsonResponse
    {
        $ratings = Rating::with(['raterOrg', 'freightJob'])
            ->where('ratee_id', $org->id)
            ->where('is_public', true)
            ->latest()
            ->paginate(10);

        return response()->json([
            'data' => collect($ratings->items())->map(fn ($r) => $this->format($r)),
            'meta' => [
                'current_page' => $ratings->currentPage(),
                'last_page'    => $ratings->lastPage(),
                'total'        => $ratings->total(),
                'per_page'     => $ratings->perPage(),
            ],
        ]);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function format(Rating $r): array
    {
        return [
            'id'            => $r->id,
            'rater_type'    => $r->rater_type,
            'rater_org'     => $r->raterOrg?->name,
            'job_title'     => $r->freightJob?->title,
            'overall'       => $r->overall,
            'communication' => $r->communication,
            'reliability'   => $r->reliability,
            'average'       => $r->averageScore(),
            'comment'       => $r->comment,
            'is_public'     => $r->is_public,
            'created_at'    => $r->created_at?->toISOString(),
        ];
    }

    /**
     * After a carrier-rated-by-shipper rating, update the carrier profile avg.
     * After a shipper-rated-by-carrier rating, update the shipper profile avg.
     */
    private function recalculate(string $raterType, int $rateeOrgId): void
    {
        $agg = Rating::where('ratee_id', $rateeOrgId)
            ->select(
                DB::raw('ROUND(AVG((overall + communication + reliability) / 3.0), 2) as avg_rating'),
                DB::raw('COUNT(*) as total')
            )
            ->first();

        if (! $agg) return;

        if ($raterType === 'shipper') {
            // Shipper rated carrier → update carrier profile
            CarrierProfile::where('org_id', $rateeOrgId)->update([
                'rating'        => $agg->avg_rating,
                'total_ratings' => $agg->total,
            ]);
        } else {
            // Carrier rated shipper → update shipper profile
            ShipperProfile::where('org_id', $rateeOrgId)->update([
                'rating'        => $agg->avg_rating,
                'total_ratings' => $agg->total,
            ]);
        }
    }
}
