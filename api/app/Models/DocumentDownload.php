<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One download (or emailed copy) of a check PDF: who, whose, which and when */
class DocumentDownload extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'subject_user_id', 'kind', 'ref_type', 'ref_id', 'ip'];
}
