<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FreightJob;
use App\Models\JobEvidence;
use App\Models\JobStop;
use App\Services\DocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EvidenceController extends Controller
{
    private const DISK = 'documents';

    // ── GET /api/v1/jobs/{job}/stops/{stop}/evidence ───────────────────────────

    public function index(Request $request, FreightJob $job, JobStop $stop): JsonResponse
    {
        $this->authorise($request, $job);
        abort_if($stop->freight_job_id !== $job->id, 404);

        $evidence = $stop->evidence()
            ->with('uploader:id,name')
            ->orderBy('taken_at')
            ->orderBy('created_at')
            ->get()
            ->map(fn($e) => $this->shape($e));

        return response()->json([
            'data'       => $evidence,
            'stop'       => $this->stopShape($stop),
        ]);
    }

    // ── POST /api/v1/jobs/{job}/stops/{stop}/evidence ─────────────────────────
    // Multipart: file (required), evidence_type, notes, lat, lng, taken_at
    // OR base64 signature: signature_data (base64 PNG), signature_name

    public function store(Request $request, FreightJob $job, JobStop $stop): JsonResponse
    {
        $this->authorise($request, $job);
        abort_if($stop->freight_job_id !== $job->id, 404);

        // ── Signature upload (base64 canvas data) ─────────────────────────
        if ($request->filled('signature_data')) {
            return $this->storeSignature($request, $job, $stop);
        }

        // ── Photo / file upload ───────────────────────────────────────────
        $request->validate([
            'file'           => ['required', 'file', 'mimes:jpeg,jpg,png,heic,heif,webp,mp4,mov', 'max:51200'],
            'evidence_type'  => ['sometimes', 'string', 'in:pickup,dropoff,damage,other'],
            'notes'          => ['sometimes', 'nullable', 'string', 'max:500'],
            'lat'            => ['sometimes', 'nullable', 'numeric'],
            'lng'            => ['sometimes', 'nullable', 'numeric'],
            'taken_at'       => ['sometimes', 'nullable', 'date'],
        ]);

        $file   = $request->file('file');
        $ext    = $file->getClientOriginalExtension();
        $key    = "evidence/{$job->id}/{$stop->id}/" . Str::uuid() . ".{$ext}";

        Storage::disk(self::DISK)->putFileAs(
            dirname($key),
            $file,
            basename($key),
            'public'
        );

        $url = Storage::disk(self::DISK)->url($key);

        // Infer evidence type from stop type if not provided
        $evidenceType = $request->input('evidence_type', $stop->stop_type === 'pickup' ? 'pickup' : 'dropoff');

        $evidence = JobEvidence::create([
            'freight_job_id'  => $job->id,
            'job_stop_id'     => $stop->id,
            'uploaded_by'     => $request->user()->id,
            'evidence_type'   => $evidenceType,
            'file_key'        => $key,
            'file_url'        => $url,
            'file_size_bytes' => $file->getSize(),
            'mime_type'       => $file->getMimeType(),
            'lat'             => $request->input('lat'),
            'lng'             => $request->input('lng'),
            'taken_at'        => $request->input('taken_at') ?? now(),
            'notes'           => $request->input('notes'),
        ]);

        $evidence->load('uploader:id,name');

        return response()->json(['data' => $this->shape($evidence)], 201);
    }

    // ── DELETE /api/v1/jobs/{job}/evidence/{evidence} ─────────────────────────

    public function destroy(Request $request, FreightJob $job, JobEvidence $evidence): JsonResponse
    {
        $this->authorise($request, $job);
        abort_if($evidence->freight_job_id !== $job->id, 404);

        // Only the uploader or the shipper can delete
        $uid = $request->user()->id;
        abort_if($evidence->uploaded_by !== $uid && !$request->user()->isShipperOf($job), 403);

        Storage::disk(self::DISK)->delete($evidence->file_key);
        $evidence->delete();

        return response()->json(['message' => 'Deleted']);
    }

    // ── POST /api/v1/jobs/{job}/stops/{stop}/signature ────────────────────────
    // Saves signature and triggers POD PDF generation

    public function signature(Request $request, FreightJob $job, JobStop $stop): JsonResponse
    {
        $this->authorise($request, $job);
        abort_if($stop->freight_job_id !== $job->id, 404);

        $request->validate([
            'signature_data' => ['required', 'string'],   // base64 PNG data URI or raw base64
            'signature_name' => ['required', 'string', 'max:120'],
        ]);

        return $this->storeSignature($request, $job, $stop);
    }

    // ── POST /api/v1/jobs/{job}/stops/{stop}/pod ──────────────────────────────
    // Generate (or re-generate) POD PDF for a stop and return its URL

    public function generatePod(Request $request, FreightJob $job, JobStop $stop): JsonResponse
    {
        $this->authorise($request, $job);
        abort_if($stop->freight_job_id !== $job->id, 404);

        $url = app(DocumentService::class)->pod($job, $stop, storeResult: true);

        return response()->json(['url' => $url]);
    }

    // ── GET /api/v1/jobs/{job}/stops/{stop}/pod ───────────────────────────────
    // Stream POD PDF inline

    public function downloadPod(Request $request, FreightJob $job, JobStop $stop)
    {
        $this->authorise($request, $job);
        abort_if($stop->freight_job_id !== $job->id, 404);

        return app(DocumentService::class)->podResponse($job, $stop, (bool) $request->boolean('download'));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function storeSignature(Request $request, FreightJob $job, JobStop $stop): JsonResponse
    {
        $request->validate([
            'signature_data' => ['required', 'string'],
            'signature_name' => ['required', 'string', 'max:120'],
        ]);

        $raw = $request->input('signature_data');

        // Strip data URI prefix if present: "data:image/png;base64,..."
        $base64 = preg_replace('/^data:image\/\w+;base64,/', '', $raw);
        $bytes  = base64_decode($base64);

        if (!$bytes) {
            return response()->json(['message' => 'Invalid signature data.'], 422);
        }

        $key = "signatures/{$job->id}/{$stop->id}/sig_" . now()->format('YmdHis') . '.png';

        Storage::disk(self::DISK)->put($key, $bytes, 'public');
        $url = Storage::disk(self::DISK)->url($key);

        $stop->update([
            'signature_key'  => $key,
            'signature_url'  => $url,
            'signature_name' => $request->input('signature_name'),
            'signature_at'   => now(),
            'signature_ip'   => $request->ip(),
        ]);

        // Also save as a signature evidence record
        JobEvidence::updateOrCreate(
            ['freight_job_id' => $job->id, 'job_stop_id' => $stop->id, 'evidence_type' => 'signature'],
            [
                'uploaded_by'    => $request->user()->id,
                'file_key'       => $key,
                'file_url'       => $url,
                'mime_type'      => 'image/png',
                'taken_at'       => now(),
                'notes'          => 'Signed by: ' . $request->input('signature_name'),
            ]
        );

        return response()->json([
            'signature_url'  => $url,
            'signature_name' => $stop->signature_name,
            'signature_at'   => $stop->signature_at,
        ]);
    }

    private function authorise(Request $request, FreightJob $job): void
    {
        $user = $request->user();
        abort_unless($user->isShipperOf($job) || $user->isCarrierOf($job), 403);
    }

    private function shape(JobEvidence $e): array
    {
        return [
            'id'            => $e->id,
            'evidence_type' => $e->evidence_type,
            'file_url'      => $e->file_url,
            'mime_type'     => $e->mime_type,
            'file_size_bytes'=> $e->file_size_bytes,
            'lat'           => $e->lat,
            'lng'           => $e->lng,
            'taken_at'      => $e->taken_at?->toISOString(),
            'notes'         => $e->notes,
            'uploader'      => $e->uploader ? [
                'id'   => $e->uploader->id,
                'name' => $e->uploader->name,
            ] : null,
        ];
    }

    private function stopShape(JobStop $stop): array
    {
        return [
            'id'             => $stop->id,
            'stop_type'      => $stop->stop_type,
            'status'         => $stop->status,
            'photos_required'=> $stop->photos_required,
            'signature_url'  => $stop->signature_url,
            'signature_name' => $stop->signature_name,
            'signature_at'   => $stop->signature_at?->toISOString(),
            'pod_pdf_url'    => $stop->pod_pdf_url,
            'pod_generated_at'=> $stop->pod_generated_at?->toISOString(),
        ];
    }
}
