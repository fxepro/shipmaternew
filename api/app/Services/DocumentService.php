<?php

namespace App\Services;

use App\Models\Contract;
use App\Models\FreightJob;
use App\Models\JobEvidence;
use App\Models\JobStop;
use App\Models\Organization;
use App\Models\PlatformTenant;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DocumentService
{
    // ── Public entry points ────────────────────────────────────────────────────

    /**
     * Rate Confirmation PDF for a FreightJob.
     * Returns a Laravel Response streaming the PDF inline / as download.
     */
    public function rateConfirmation(FreightJob $job, bool $download = false): Response
    {
        $job->load([
            'shipper.platformTenant',
            'carrier',
            'stops.location',
        ]);

        $broker  = $this->brokerIdentity($job->shipper);
        $carrier = $this->carrierIdentity($job->carrier);
        $stops   = $job->stops;

        $breakdown = $job->cost_breakdown ?? [];
        $totalCents = $job->payment_amount_cents ?? 0;

        $data = [
            'broker'    => $broker,
            'carrier'   => $carrier,
            'job'       => $job,
            'stops'     => $stops,
            'breakdown' => $breakdown,
            'total'     => $totalCents / 100,
            'generated' => now()->format('M j, Y'),
        ];

        $filename = 'rate-confirmation-' . ($job->reference_number ?? $job->id) . '.pdf';
        return $this->render('documents.rate_confirmation', $data, $broker, $filename, $download);
    }

    /**
     * Carrier Agreement PDF for a Contract.
     */
    public function carrierAgreement(Contract $contract, bool $download = false): Response
    {
        $contract->load([
            'shipper.platformTenant',
            'carrier',
        ]);

        $broker  = $this->brokerIdentity($contract->shipper);
        $carrier = $this->carrierIdentity($contract->carrier);

        $data = [
            'broker'    => $broker,
            'carrier'   => $carrier,
            'contract'  => $contract,
            'generated' => now()->format('M j, Y'),
        ];

        $filename = 'carrier-agreement-' . $contract->id . '.pdf';
        return $this->render('documents.carrier_agreement', $data, $broker, $filename, $download);
    }

    // ── Invoice ───────────────────────────────────────────────────────────────

    /**
     * Shipper-facing Invoice / Settlement Statement for a completed FreightJob.
     * Generates once and stores; subsequent calls stream the stored copy unless $forceRegen.
     */
    public function invoice(FreightJob $job, bool $download = false, bool $forceRegen = false): Response
    {
        $job->load([
            'shipper.platformTenant',
            'carrier',
            'stops',
        ]);

        $broker  = $this->brokerIdentity($job->shipper);
        $carrier = $job->carrier ? $this->carrierIdentity($job->carrier) : null;

        // Generate / reuse invoice number
        if (!$job->invoice_number) {
            $num = str_pad($job->id, 6, '0', STR_PAD_LEFT);
            $job->invoice_number = 'INV-' . now()->format('Y') . '-' . $num;
        }

        // Build line items from cost_breakdown
        $bd    = is_array($job->cost_breakdown) ? $job->cost_breakdown : [];
        $lines = [];

        if (!empty($bd['base_amount']))   $lines[] = ['label' => 'Freight charge',   'amount' => (float) $bd['base_amount']];
        if (!empty($bd['fuel_amount']))   $lines[] = ['label' => 'Fuel surcharge',    'amount' => (float) $bd['fuel_amount']];
        if (!empty($bd['platform_fee']))  $lines[] = ['label' => 'Platform fee',      'amount' => (float) $bd['platform_fee']];

        // Fallback: if no breakdown, just show total
        if (empty($lines) && $job->payment_amount_cents) {
            $lines[] = ['label' => 'Freight services', 'amount' => $job->payment_amount_cents / 100];
        }

        $totalDollars = collect($lines)->sum('amount');

        // Payment terms: default net-30 from job posted_at
        $invoiceDate  = $job->invoice_date  ?? ($job->posted_at?->toDateString() ?? now()->toDateString());
        $dueDate      = $job->invoice_due_date ?? now()->parse($invoiceDate)->addDays(30)->toDateString();

        $data = [
            'broker'       => $broker,
            'carrier'      => $carrier,
            'job'          => $job,
            'lines'        => $lines,
            'total'        => $totalDollars,
            'invoice_date' => $invoiceDate,
            'due_date'     => $dueDate,
            'generated'    => now()->format('M j, Y g:i A'),
        ];

        $filename  = $job->invoice_number . '.pdf';
        $pdfOutput = $this->generatePdfOutput('documents.invoice', $data);

        // Store first time (or force regen)
        if ($forceRegen || !$job->invoice_pdf_key) {
            $key = "invoices/{$job->id}/" . Str::uuid() . '.pdf';
            Storage::disk('documents')->put($key, $pdfOutput, 'public');
            $url = Storage::disk('documents')->url($key);

            $job->update([
                'invoice_number'       => $job->invoice_number,
                'invoice_date'         => $invoiceDate,
                'invoice_due_date'     => $dueDate,
                'invoice_pdf_key'      => $key,
                'invoice_pdf_url'      => $url,
                'invoice_generated_at' => now(),
            ]);
        }

        $disposition = $download ? 'attachment' : 'inline';
        return response($pdfOutput, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "{$disposition}; filename=\"{$filename}\"",
        ]);
    }

    // ── BOL ───────────────────────────────────────────────────────────────────

    /**
     * Bill of Lading — generated at dispatch (when job is posted).
     * Stored to the documents disk; subsequent calls return the stored URL.
     * Pass $forceRegen=true to regenerate even if a stored version exists.
     */
    public function bol(FreightJob $job, bool $download = false, bool $forceRegen = false): Response
    {
        $job->load([
            'shipper.platformTenant',
            'carrier',
            'stops.location',
            'stops.pickupItems',
            'stops.deliveryItems',
        ]);

        $broker  = $this->brokerIdentity($job->shipper);
        $carrier = $job->carrier ? $this->carrierIdentity($job->carrier) : null;

        $data = [
            'broker'    => $broker,
            'carrier'   => $carrier,
            'job'       => $job,
            'stops'     => $job->stops,
            'generated' => now()->format('M j, Y g:i A'),
        ];

        $filename = 'BOL-' . ($job->reference_number ?? $job->id) . '.pdf';
        $pdfOutput = $this->generatePdfOutput('documents.bol', $data);

        // Store and update the job row if not yet stored (or forced)
        if ($forceRegen || !$job->bol_pdf_key) {
            $key = "bol/{$job->id}/" . Str::uuid() . '.pdf';
            Storage::disk('documents')->put($key, $pdfOutput, 'public');
            $url = Storage::disk('documents')->url($key);
            $job->update([
                'bol_pdf_key'       => $key,
                'bol_pdf_url'       => $url,
                'bol_generated_at'  => now(),
            ]);
        }

        $disposition = $download ? 'attachment' : 'inline';
        return response($pdfOutput, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "{$disposition}; filename=\"{$filename}\"",
        ]);
    }

    // ── POD ───────────────────────────────────────────────────────────────────

    /**
     * Proof of Delivery (or Proof of Pickup) for a single stop.
     * Embeds all photos taken at that stop + the drawn signature.
     * Stored to the documents disk.
     */
    public function podResponse(FreightJob $job, JobStop $stop, bool $download = false): Response
    {
        $job->load(['shipper.platformTenant', 'carrier']);
        $stop->load(['evidence' => fn($q) => $q->orderBy('taken_at')]);

        $broker  = $this->brokerIdentity($job->shipper);
        $carrier = $job->carrier ? $this->carrierIdentity($job->carrier) : null;

        $photos    = $stop->evidence->filter(fn($e) => str_starts_with($e->mime_type ?? '', 'image/'));
        $signature = $stop->evidence->first(fn($e) => $e->evidence_type === 'signature');

        $data = [
            'broker'       => $broker,
            'carrier'      => $carrier,
            'job'          => $job,
            'stop'         => $stop,
            'photos'       => $photos->map(fn($e) => $this->evidenceToBase64($e)),
            'signature_b64'=> $stop->signature_key ? $this->fileToBase64('documents', $stop->signature_key) : null,
            'is_pickup'    => $stop->stop_type === 'pickup',
            'generated'    => now()->format('M j, Y g:i A'),
        ];

        $typeLabel = $stop->stop_type === 'pickup' ? 'Pickup-POD' : 'Delivery-POD';
        $filename  = "{$typeLabel}-{$job->id}-stop{$stop->id}.pdf";
        $pdfOutput = $this->generatePdfOutput('documents.pod', $data);

        // Store once
        if (!$stop->pod_pdf_key) {
            $key = "pod/{$job->id}/{$stop->id}/" . Str::uuid() . '.pdf';
            Storage::disk('documents')->put($key, $pdfOutput, 'public');
            $url = Storage::disk('documents')->url($key);
            $stop->update([
                'pod_pdf_key'      => $key,
                'pod_pdf_url'      => $url,
                'pod_generated_at' => now(),
            ]);
        }

        $disposition = $download ? 'attachment' : 'inline';
        return response($pdfOutput, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "{$disposition}; filename=\"{$filename}\"",
        ]);
    }

    /**
     * Generate POD and return its stored URL (used by EvidenceController).
     */
    public function pod(FreightJob $job, JobStop $stop, bool $storeResult = true): string
    {
        $this->podResponse($job, $stop);   // side-effect: stores PDF if not stored
        $stop->refresh();
        return $stop->pod_pdf_url ?? '';
    }

    // ── Identity helpers ──────────────────────────────────────────────────────

    /**
     * Resolve broker (shipper company) identity, preferring tenant white-label config.
     *
     * Priority:
     *   1. PlatformTenant dba_name / brand_name (if the company is a WL tenant)
     *   2. The company's DBA, then its legal name
     */
    private function brokerIdentity(?Organization $org): array
    {
        $tenant  = $org?->platformTenant;
        $owner   = $org ? User::find($org->owner_id) : null;

        $displayName = $tenant?->dba_name
            ?? $tenant?->brand_name
            ?? ($org?->dba ?: null)
            ?? $org?->name
            ?? '';

        $street = $org?->street ?? '';
        $city   = $org?->city   ?? '';
        $state  = $org?->state  ?? '';
        $zip    = $org?->zip    ?? '';

        $addressLine = implode(', ', array_filter([
            $street,
            $city,
            trim("$state $zip"),
        ]));

        return [
            'name'        => $displayName,
            'legal_name'  => $org?->legal_name ?: ($org?->name ?? ''),
            'mc_number'   => $org?->fmcsa_broker_mc ?? '',
            'email'       => $org?->email ?: ($owner?->email ?? ''),
            'phone'       => $org?->phone ?? '',
            'address'     => $addressLine,
            // Branding for the PDF header
            'logo_url'    => $tenant?->logo_url_dark ?? null,
            'primary_color' => $tenant?->primary_color ?? '#0096C7',
        ];
    }

    /**
     * Resolve carrier company identity.
     */
    private function carrierIdentity(Organization $carrier): array
    {
        $owner = User::find($carrier->owner_id);
        return [
            'name'        => $carrier->name,
            'mc_number'   => $carrier->carrier_mc_number ? 'MC-' . $carrier->carrier_mc_number : '',
            'dot_number'  => $carrier->carrier_dot_number ?? '',
            'email'       => $carrier->email ?: ($owner?->email ?? ''),
            'phone'       => $carrier->phone ?? '',
            'address'     => implode(', ', array_filter([
                $carrier->street ?? '',
                $carrier->city   ?? '',
                trim(($carrier->state ?? '') . ' ' . ($carrier->zip ?? '')),
            ])),
        ];
    }

    // ── PDF render ────────────────────────────────────────────────────────────

    private function render(string $view, array $data, array $broker, string $filename, bool $download): Response
    {
        $pdfOutput = $this->generatePdfOutput($view, $data);
        $disposition = $download ? 'attachment' : 'inline';
        return response($pdfOutput, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => "{$disposition}; filename=\"{$filename}\"",
        ]);
    }

    private function generatePdfOutput(string $view, array $data): string
    {
        return Pdf::loadView($view, $data)
            ->setPaper('letter', 'portrait')
            ->setWarnings(false)
            ->output();
    }

    // ── Image helpers for PDF embedding ──────────────────────────────────────

    /**
     * Convert a stored evidence file to a base64 data URI for embedding in PDF.
     */
    private function evidenceToBase64(JobEvidence $e): ?string
    {
        return $this->fileToBase64('documents', $e->file_key, $e->mime_type ?? 'image/jpeg');
    }

    /**
     * Read a file from a storage disk and return a base64 data URI.
     */
    private function fileToBase64(string $disk, string $key, string $mime = 'image/png'): ?string
    {
        try {
            $contents = Storage::disk($disk)->get($key);
            if (!$contents) return null;
            $b64 = base64_encode($contents);
            return "data:{$mime};base64,{$b64}";
        } catch (\Throwable) {
            return null;
        }
    }
}
