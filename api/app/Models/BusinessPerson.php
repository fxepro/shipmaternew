<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A factor's representative, or an owner with 25%+ of a carrier or factor, as sent to Stripe */
class BusinessPerson extends Model
{
    protected $table = 'business_people';

    protected $fillable = [
        'organization_id', 'is_representative', 'first_name', 'last_name', 'email', 'phone', 'dob',
        'street', 'city', 'state', 'zip', 'ssn_last_4', 'title', 'percent_ownership', 'stripe_person_id',
    ];

    protected $hidden = ['ssn_last_4'];

    protected function casts(): array
    {
        return [
            'is_representative' => 'boolean',
            'dob'               => 'date',
            'ssn_last_4'        => 'encrypted',
            'percent_ownership' => 'float',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
