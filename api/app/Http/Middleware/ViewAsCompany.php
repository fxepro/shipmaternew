<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin Console, Carrier View and Shipper View: a platform admin reads a company's pages as that company.
 *
 * The frontend sends the company's id in X-View-As-Org. For platform admins only, and for this request only,
 * the company becomes the admin's current company (in memory, never saved) with view access to every action,
 * and anything other than a read is refused. The header is ignored for everyone else.
 */
class ViewAsCompany
{
    public const HEADER = 'X-View-As-Org';

    public function handle(Request $request, Closure $next): Response
    {
        $id   = $request->header(self::HEADER);
        $user = $request->user();
        if (!$id || !$user?->isPlatformAdmin()) return $next($request);

        $org = ctype_digit((string) $id)
            ? Organization::whereIn('type', ['carrier', 'shipper', 'factor'])->find((int) $id)
            : null;
        if (!$org) {
            return response()->json(['error' => 'That company was not found.', 'code' => 'view_as_not_found'], 404);
        }

        if (!$request->isMethodSafe()) {
            return response()->json([
                'error' => "You're viewing {$org->name} as an admin. Viewing is read-only.",
                'code'  => 'read_only',
            ], 403);
        }

        $user->viewAs($org);

        // One log row per admin, company and half hour
        if (Cache::add("admin_company_view:{$user->id}:{$org->id}", 1, now()->addMinutes(30))) {
            DB::table('admin_company_views')->insert([
                'user_id' => $user->id, 'org_id' => $org->id,
                'path' => substr('/' . $request->path(), 0, 255), 'created_at' => now(),
            ]);
        }

        return $next($request);
    }
}
