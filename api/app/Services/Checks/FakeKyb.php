<?php

namespace App\Services\Checks;

use App\Models\Organization;
use Illuminate\Http\Request;

/**
 * Test provider for local work: answers at once in Middesk's shape, no outside call.
 * A legal name containing FAIL fails every task, SANCTION fails only the sanctions screen,
 * and an EIN of 000000000 fails the TIN match. Never offered on the live site.
 */
class FakeKyb implements KybProvider
{
    public function key(): string { return 'fake'; }
    public function name(): string { return 'Test provider'; }
    public function configured(string $mode): bool { return !app()->environment('production'); }

    public function create(Organization $o, array $input, string $mode): array
    {
        $fail = str_contains(strtoupper($input['name']), 'FAIL');
        $task = fn ($key, $ok, $sub) => ['key' => $key, 'status' => $ok ? 'success' : 'failure', 'sub_label' => $sub];
        $owner = $o->owner?->name;
        return [
            'id'     => "fake_biz_{$o->id}",
            'status' => 'approved',
            'review' => ['tasks' => [
                $task('tin', !$fail && $input['tin'] !== '000000000', !$fail && $input['tin'] !== '000000000' ? 'Found' : 'Mismatch'),
                $task('sos_active', !$fail, $fail ? 'Inactive' : 'Active'),
                $task('address_verification', !$fail, $fail ? 'Not found' : 'Verified'),
                $task('watchlist', !$fail && !str_contains(strtoupper($input['name']), 'SANCTION'), 'No Hits'),
            ]],
            'people' => $owner ? [['name' => $owner, 'titles' => [['title' => 'Owner']]]] : [],
        ];
    }

    public function fetch(string $id, string $mode): array
    {
        $o = Organization::find((int) str_replace('fake_biz_', '', $id));
        return $o && ($input = Kyb::input($o)) ? $this->create($o, $input, $mode) : [];
    }

    public function parseWebhook(Request $request): ?string { return ''; }
    public function testConnection(string $mode): string { return 'The test provider answers locally; nothing is sent.'; }
}
