<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Permissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Admin Console, Settings, Roles & Permissions: the company role matrix for shippers, carriers and factors.
 * Admins change a role's level for an action; the owner column and own-record rows can't be changed.
 */
class AdminRoleController extends Controller
{
    // GET /api/v1/admin/roles/matrix
    public function show(Request $request): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);

        return response()->json([
            'data' => [
                'types'   => array_map(fn ($t) => Permissions::matrix($t), array_combine(array_keys(Permissions::ROLES), array_keys(Permissions::ROLES))),
                'changes' => $this->recent(),
            ],
        ]);
    }

    // PUT /api/v1/admin/roles/matrix/{type}   { changes: [{ role, permission, level }] }
    public function update(Request $request, string $type): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        abort_unless(isset(Permissions::ROLES[$type]), 404);

        $data = $request->validate([
            'changes'              => ['required', 'array', 'min:1', 'max:200'],
            'changes.*.role'       => ['required', Rule::in(Permissions::ROLES[$type])],
            'changes.*.permission' => ['required', Rule::in(array_keys(Permissions::CATALOG[$type]))],
            'changes.*.level'      => ['required', Rule::in(Permissions::LEVELS)],
        ]);

        // Check every change before saving any of them
        foreach ($data['changes'] as $c) {
            if (!Permissions::editable($type, $c['role'], $c['permission'])) {
                return response()->json(['error' => "The {$c['role']} level for this action can't be changed.", 'code' => 'locked'], 422);
            }
            if (!in_array($c['level'], Permissions::CATALOG[$type][$c['permission']][2], true)) {
                return response()->json(['error' => "\"{$c['level']}\" isn't a level this action can have.", 'code' => 'bad_level'], 422);
            }
        }

        $saved = 0;
        DB::transaction(function () use ($data, $type, $request, &$saved) {
            foreach ($data['changes'] as $c) {
                $old = Permissions::level($type, $c['role'], $c['permission']);
                if ($old === $c['level']) continue;

                $key = ['org_type' => $type, 'role' => $c['role'], 'permission' => $c['permission']];
                if ($c['level'] === Permissions::default($type, $c['role'], $c['permission'])) {
                    DB::table('role_permissions')->where($key)->delete();
                } else {
                    DB::table('role_permissions')->updateOrInsert($key, [
                        'level' => $c['level'], 'updated_by' => $request->user()->id, 'updated_at' => now(), 'created_at' => now(),
                    ]);
                }
                DB::table('role_permission_changes')->insert($key + [
                    'old_level' => $old, 'new_level' => $c['level'], 'user_id' => $request->user()->id, 'created_at' => now(),
                ]);
                $saved++;
                Permissions::forget(); // the next level() call reads the new value
            }
        });
        Permissions::forget();

        return response()->json([
            'message' => $saved ? "Saved {$saved} change" . ($saved === 1 ? '' : 's') . '.' : 'Nothing changed.',
            'data'    => ['matrix' => Permissions::matrix($type), 'changes' => $this->recent()],
        ]);
    }

    // POST /api/v1/admin/roles/matrix/{type}/reset
    public function reset(Request $request, string $type): JsonResponse
    {
        abort_unless($request->user()->isPlatformAdmin(), 403);
        abort_unless(isset(Permissions::ROLES[$type]), 404);

        DB::transaction(function () use ($type, $request) {
            foreach (DB::table('role_permissions')->where('org_type', $type)->get() as $r) {
                DB::table('role_permission_changes')->insert([
                    'org_type' => $type, 'role' => $r->role, 'permission' => $r->permission,
                    'old_level' => $r->level, 'new_level' => Permissions::default($type, $r->role, $r->permission),
                    'user_id' => $request->user()->id, 'created_at' => now(),
                ]);
            }
            DB::table('role_permissions')->where('org_type', $type)->delete();
        });
        Permissions::forget();

        return response()->json([
            'message' => 'Reset to defaults.',
            'data'    => ['matrix' => Permissions::matrix($type), 'changes' => $this->recent()],
        ]);
    }

    /** The latest changes, newest first */
    private function recent(): array
    {
        return DB::table('role_permission_changes as c')
            ->leftJoin('users as u', 'u.id', '=', 'c.user_id')
            ->orderByDesc('c.id')->limit(50)
            ->get(['c.id', 'c.org_type', 'c.role', 'c.permission', 'c.old_level', 'c.new_level', 'c.created_at', 'u.name as changed_by'])
            ->map(fn ($c) => (array) $c + ['label' => Permissions::CATALOG[$c->org_type][$c->permission][1] ?? $c->permission])
            ->all();
    }
}
