<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    // ── GET /transactions ─────────────────────────────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $rows = Transaction::with(['carrier.carrierProfile', 'paymentMethod', 'user'])
            ->where('shipper_id', $request->user()->current_org_id)
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($t) {
                $pm     = $t->paymentMethod;
                $pmText = $pm
                    ? ($pm->type === 'card'
                        ? "{$pm->brand} \u{2022}\u{2022}\u{2022}\u{2022} {$pm->last4}"
                        : "{$pm->bank_name} \u{2022}\u{2022}\u{2022}\u{2022} {$pm->last4}")
                    : 'N/A';

                $name   = \App\Services\PersonChecks::companyName($t->carrier) ?? '';
                $parts  = explode(' ', $name);
                $avatar = strtoupper(substr($parts[0], 0, 1) . (isset($parts[1]) ? substr($parts[1], 0, 1) : ''));

                return [
                    'id'             => $t->id,
                    'invoice_no'     => $t->invoice_no,
                    'shipment'       => $t->description,
                    'tracking_token' => $t->invoice_no,
                    'carrier_id'     => $t->carrier_id,
                    'user_id'        => $t->user_id,
                    'carrier'        => $t->user?->name ?? $name,
                    'carrier_company'=> $t->carrier->carrierProfile?->company_name ?? $name,
                    'carrier_avatar' => $avatar,
                    'amount'         => $t->amount,
                    'date'           => $t->created_at->format('Y-m-d'),
                    'due_date'       => $t->due_date->format('Y-m-d'),
                    'status'         => $t->status,
                    'payment_method' => $pmText,
                    'pickup'         => $t->pickup ?? '',
                    'delivery'       => $t->delivery ?? '',
                    'category'       => $t->category ?? '',
                    'notes'          => $t->notes,
                ];
            });

        return response()->json(['data' => $rows]);
    }
}
