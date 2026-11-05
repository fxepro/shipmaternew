<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The legal business name on the owner's profile is the company's name.
 * Companies created before this were named after the person ("Alex Morgan's Shipper"); rename them where a legal name is set.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['shipper' => 'shipper_profiles', 'carrier' => 'carrier_profiles'] as $type => $table) {
            $rows = DB::table('organizations as o')
                ->join("$table as p", fn ($j) => $j->on('p.user_id', '=', 'o.owner_id'))
                ->where('o.type', $type)
                ->whereNotNull('p.company_name')->where('p.company_name', '<>', '')
                ->get(['o.id', 'o.name', 'o.legal_name', 'p.company_name']);

            foreach ($rows as $r) {
                $name = trim($r->company_name);
                if ($name === '' || $name === $r->name) continue;
                DB::table('organizations')->where('id', $r->id)->update([
                    'name'       => $name,
                    'legal_name' => $r->legal_name ?: $name,
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        // Names are data; the old person-based names are not restored
    }
};
