<?php

namespace App\Services\Checks;

use App\Models\Organization;
use Illuminate\Http\Request;

interface KybProvider
{
    public function key(): string;
    public function name(): string;
    public function configured(string $mode): bool;
    /** Create the business at the provider; returns the provider's business object (id, status, review.tasks, people) */
    public function create(Organization $o, array $input, string $mode): array;
    public function fetch(string $id, string $mode): array;
    /** The business id a webhook is about, null when the signature is wrong, '' when the event can be ignored */
    public function parseWebhook(Request $request): ?string;
    public function testConnection(string $mode): string;
}
