<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FMCSA public data kept per company (App\Services\FmcsaOpenData): insurance filings, BOC-3,
 * authority history, revocations and SMS safety measures.
 * A new row is added only when the record changes, so the rows are the company's FMCSA history;
 * pulled_at is the last time the latest row was confirmed against FMCSA.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fmcsa_records', function (Blueprint $t) {
            $t->id();
            $t->foreignId('org_id')->constrained('organizations')->cascadeOnDelete();
            $t->string('dot', 20)->nullable();
            $t->string('mc', 20)->nullable();
            $t->json('data');
            $t->char('data_hash', 64);
            $t->timestamp('pulled_at');
            $t->timestamps();
            $t->index(['org_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fmcsa_records');
    }
};
