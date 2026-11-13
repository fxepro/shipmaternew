<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Public company profiles at /c/{profile_slug} (demo/public-profiles.html). The slug comes from the company name and
 * never changes; `slug` stays the internal/tenant one. `about` is the company's own text, up to 1,000 words.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('organizations', function (Blueprint $t) {
            $t->string('profile_slug', 120)->nullable()->unique();
            $t->text('about')->nullable();
        });

        $taken = [];
        foreach (DB::table('organizations')->orderBy('id')->get(['id', 'name', 'legal_name']) as $o) {
            $base = Str::slug($o->name ?: $o->legal_name ?: 'company') ?: 'company';
            $slug = $base; $n = 2;
            while (isset($taken[$slug])) $slug = $base . '-' . $n++;
            $taken[$slug] = true;
            DB::table('organizations')->where('id', $o->id)->update(['profile_slug' => $slug]);
        }
    }

    public function down(): void
    {
        Schema::table('organizations', fn (Blueprint $t) => $t->dropColumn(['profile_slug', 'about']));
    }
};
