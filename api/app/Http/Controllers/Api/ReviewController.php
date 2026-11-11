<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FreightJob;
use App\Models\JobStop;
use App\Models\LoadPerson;
use App\Models\Location;
use App\Models\Noa;
use App\Models\Organization;
use App\Models\Review;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Reviews: each company gives feedback to the one it worked with (see the reviews migration).
 *
 * On a completed load:  shipper ↔ broker, broker ↔ carrier, shipper ↔ carrier (when there is no broker),
 *                       receiver ↔ carrier.
 * On factoring (an NOA the factor accepted): carrier ↔ factor.
 */
class ReviewController extends Controller
{
    private const SCORES = [
        'overall'       => ['required', 'integer', 'min:1', 'max:5'],
        'communication' => ['required', 'integer', 'min:1', 'max:5'],
        'reliability'   => ['required', 'integer', 'min:1', 'max:5'],
        'comment'       => ['nullable', 'string', 'max:1000'],
        'reviewee_org_id' => ['nullable', 'integer'],
    ];

    // ── Loads ────────────────────────────────────────────────────────────────

    /** POST /api/v1/jobs/{job}/ratings. reviewee_org_id picks who, when the person's company worked with more than one. */
    public function store(Request $request, FreightJob $job): JsonResponse
    {
        if ($job->status !== 'completed') {
            return response()->json(['message' => 'You can only leave a review after the load is completed.'], 422);
        }
        $user = $request->user();
        [$role, $orgId] = $this->roleOn($user, $job);
        if (!$role) return response()->json(['message' => 'You are not a party to this load.'], 403);

        $data = $request->validate(self::SCORES);
        $targets = $this->targets($job, $role);
        $to = $data['reviewee_org_id'] ?? null;
        $target = $to ? collect($targets)->firstWhere('org_id', (int) $to) : ($targets[0] ?? null);
        if (!$target) return response()->json(['message' => 'There is no company on this load for you to review.'], 422);

        return $this->save($user, $orgId, $role, $target, $data, ['freight_job_id' => $job->id]);
    }

    /** GET /api/v1/jobs/{job}/ratings: the reviews on a load, and who the signed-in person may still review */
    public function jobRatings(Request $request, FreightJob $job): JsonResponse
    {
        $user = $request->user();
        $reviews = Review::with(['reviewerOrg', 'reviewer', 'revieweeOrg', 'freightJob'])->where('freight_job_id', $job->id)->shown()->latest()->get();
        [$role] = $this->roleOn($user, $job);
        $done = $reviews->where('reviewer_user_id', $user->id)->pluck('reviewee_org_id')->all();
        $open = $role ? array_values(array_filter($this->targets($job, $role), fn ($t) => !in_array($t['org_id'], $done))) : [];
        return response()->json(['data' => $reviews->map->toCard()->values(), 'my_role' => $role, 'can_review' => $job->status === 'completed' ? $open : []]);
    }

    // ── Factoring ────────────────────────────────────────────────────────────

    /** POST /api/v1/noas/{noa}/reviews: the carrier reviews its factor, or the factor its carrier */
    public function storeNoa(Request $request, Noa $noa): JsonResponse
    {
        $user = $request->user();
        $org = (int) $user->current_org_id;
        if (!in_array($noa->status, ['active', 'released', 'ended'], true)) {
            return response()->json(['message' => 'You can review once the factor has accepted the NOA.'], 422);
        }
        $target = match ($org) {
            (int) $noa->carrier_id => ['org_id' => (int) $noa->factor_id, 'role' => 'factor'],
            (int) $noa->factor_id  => ['org_id' => (int) $noa->carrier_id, 'role' => 'carrier'],
            default => null,
        };
        if (!$target) return response()->json(['message' => 'You are not a party to this NOA.'], 403);
        $role = $target['role'] === 'factor' ? 'carrier' : 'factor';
        return $this->save($user, $org, $role, $target, $request->validate(self::SCORES), ['noa_id' => $noa->id]);
    }

    // ── Public profile ───────────────────────────────────────────────────────

    /** GET /api/v1/orgs/{org}/ratings: reviews a company received, public and not hidden */
    public function profileRatings(Request $request, Organization $org): JsonResponse
    {
        $page = Review::with(['reviewerOrg', 'freightJob'])->where('reviewee_org_id', $org->id)->where('is_public', true)->shown()->latest()->paginate(10);
        return response()->json([
            'data' => collect($page->items())->map->toCard(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(), 'per_page' => $page->perPage()],
        ]);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    /** GET /api/v1/admin/companies/{org}/reviews: every review the company received and gave, hidden ones too */
    public function adminIndex(Request $request, Organization $org): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $with = ['reviewerOrg', 'reviewer', 'revieweeOrg', 'freightJob', 'hiddenBy'];
        $received = Review::with($with)->where('reviewee_org_id', $org->id)->latest()->get();
        $given = Review::with($with)->where('reviewer_org_id', $org->id)->latest()->get();
        $shown = $received->whereNull('hidden_at');
        $avg = fn (string $k) => $shown->count() ? round($shown->avg($k), 2) : null;
        return response()->json(['data' => [
            'summary' => [
                'average' => $shown->count() ? round($shown->avg(fn ($r) => $r->averageScore()), 2) : null,
                'count' => $shown->count(), 'hidden' => $received->count() - $shown->count(), 'given' => $given->count(),
                'overall' => $avg('overall'), 'communication' => $avg('communication'), 'reliability' => $avg('reliability'),
                'reliability_label' => Review::RELIABILITY[$org->type] ?? 'Reliability',
                'stars' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($n) => [$n => $shown->where('overall', $n)->count()]),
            ],
            'received' => $received->map->toCard()->values(),
            'given' => $given->map->toCard()->values(),
        ]]);
    }

    /** POST /api/v1/admin/reviews/{review}/hide {reason} · DELETE the same to show it again */
    public function hide(Request $request, Review $review): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $reason = $request->validate(['reason' => ['required', 'string', 'max:500']])['reason'];
        $review->update(['hidden_at' => now(), 'hidden_by' => $request->user()->id, 'hidden_reason' => $reason]);
        Review::recalculate($review->reviewee_org_id);
        return response()->json(['data' => $review->fresh(['reviewerOrg', 'reviewer', 'revieweeOrg', 'freightJob', 'hiddenBy'])->toCard()]);
    }

    public function unhide(Request $request, Review $review): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        $review->update(['hidden_at' => null, 'hidden_by' => null, 'hidden_reason' => null]);
        Review::recalculate($review->reviewee_org_id);
        return response()->json(['data' => $review->fresh(['reviewerOrg', 'reviewer', 'revieweeOrg', 'freightJob'])->toCard()]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function save(User $user, ?int $orgId, string $role, array $target, array $data, array $context): JsonResponse
    {
        $exists = Review::where($context)->where('reviewer_user_id', $user->id)->where('reviewee_org_id', $target['org_id'])->exists();
        if ($exists) return response()->json(['message' => 'You have already reviewed this company here.'], 422);

        $review = Review::create(array_merge($context, [
            'reviewer_org_id' => $orgId, 'reviewer_user_id' => $user->id, 'reviewer_role' => $role,
            'reviewee_org_id' => $target['org_id'], 'reviewee_role' => $target['role'],
            'overall' => $data['overall'], 'communication' => $data['communication'], 'reliability' => $data['reliability'],
            'comment' => $data['comment'] ?? null, 'is_public' => true,
        ]));
        Review::recalculate($target['org_id']);
        return response()->json(['data' => $review->load(['reviewerOrg', 'reviewer', 'revieweeOrg', 'freightJob'])->toCard()], 201);
    }

    /** [role, org id] of the person on this load: broker, shipper, carrier or receiver */
    private function roleOn(User $user, FreightJob $job): array
    {
        $org = $user->current_org_id ? (int) $user->current_org_id : null;
        if ($org && $job->broker_id && $org === (int) $job->broker_id) return ['broker', $org];
        if ($org && $org === (int) $job->shipper_id) return ['shipper', $org];
        if ($org && $org === (int) $job->carrier_id) return ['carrier', $org];
        if ($org && in_array($org, $this->receiverOrgs($job), true)) return ['receiver', $org];
        $onLoad = LoadPerson::where('load_type', 'freight_job')->where('load_id', $job->id)->where('user_id', $user->id)->whereNull('org_id')->exists();
        return $onLoad ? ['receiver', $org] : [null, null];
    }

    /** Receiver companies on a load: a stop at one of their locations, or added to the load */
    private function receiverOrgs(FreightJob $job): array
    {
        $byStop = Location::whereIn('id', JobStop::where('freight_job_id', $job->id)->whereNotNull('location_id')->select('location_id'))
            ->whereIn('org_id', Organization::where('type', 'receiver')->select('id'))->pluck('org_id');
        $added = LoadPerson::where('load_type', 'freight_job')->where('load_id', $job->id)->whereNotNull('org_id')
            ->whereIn('org_id', Organization::where('type', 'receiver')->select('id'))->pluck('org_id');
        return $byStop->merge($added)->map(fn ($id) => (int) $id)->unique()->values()->all();
    }

    /** Who a role on this load may review: [['org_id', 'role', 'name'], ...], the main counterpart first */
    private function targets(FreightJob $job, string $role): array
    {
        $t = [];
        $add = function (?int $id, string $r) use (&$t) { if ($id) $t[] = ['org_id' => $id, 'role' => $r]; };
        $broker = $job->broker_id ? (int) $job->broker_id : null;
        match ($role) {
            'shipper'  => $broker ? $add($broker, 'broker') : $add($job->carrier_id, 'carrier'),
            'broker'   => [$add($job->carrier_id, 'carrier'), $add($job->shipper_id, 'shipper')],
            'carrier'  => [$broker ? $add($broker, 'broker') : $add($job->shipper_id, 'shipper'), array_map(fn ($id) => $add($id, 'receiver'), $this->receiverOrgs($job))],
            'receiver' => $add($job->carrier_id, 'carrier'),
            default    => null,
        };
        $names = Organization::whereIn('id', array_column($t, 'org_id'))->pluck('name', 'id');
        return array_map(fn ($x) => $x + ['name' => $names[$x['org_id']] ?? null], $t);
    }
}
