<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One load update sent (or skipped) to a contact */
class ContactNotification extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['contact_id', 'org_id', 'freight_job_id', 'stop_id', 'event', 'channel', 'recipient', 'status', 'detail'];
}
