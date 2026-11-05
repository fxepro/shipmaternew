<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A cancelled subscription keeps running to the end of the paid month; record that so admin and the shipper can see it. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipper_subscriptions', function (Blueprint $t) {
            $t->boolean('cancel_at_period_end')->default(false)->after('status');
            $t->timestamp('canceled_at')->nullable()->after('cancel_at_period_end');
            $t->index('status');
        });
    }

    public function down(): void
    {
        Schema::table('shipper_subscriptions', function (Blueprint $t) {
            $t->dropIndex(['status']);
            $t->dropColumn(['cancel_at_period_end', 'canceled_at']);
        });
    }
};
