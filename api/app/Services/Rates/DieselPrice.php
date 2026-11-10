<?php

namespace App\Services\Rates;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * The weekly US average on-highway diesel price from the US Energy Information Administration (EIA),
 * used for the fuel surcharge in rate checks. Free; needs an EIA API key (EIA_API_KEY). Published each Monday.
 */
class DieselPrice
{
    private const SERIES = 'EMD_EPD2D_PTE_NUS_DPG';

    /** ['price' => dollars a gallon, 'period' => 'YYYY-MM-DD'], or null when no key is set or EIA did not answer */
    public static function current(): ?array
    {
        $key = (string) config('services.eia.key');
        if ($key === '') return null;
        return Cache::remember('eia:diesel', 43200, function () use ($key) {
            try {
                return self::fetch($key);
            } catch (\Throwable $e) {
                Log::warning('[EIA] diesel price failed', ['error' => $e->getMessage()]);
                return null;
            }
        });
    }

    public static function fetch(string $key): ?array
    {
        $row = Http::timeout(15)->acceptJson()->get('https://api.eia.gov/v2/petroleum/pri/gnd/data/', [
            'api_key'                => $key,
            'frequency'              => 'weekly',
            'data'                   => ['value'],
            'facets'                 => ['series' => [self::SERIES]],
            'sort'                   => [['column' => 'period', 'direction' => 'desc']],
            'length'                 => 1,
        ])->throw()->json('response.data.0');
        return $row && isset($row['value']) ? ['price' => (float) $row['value'], 'period' => (string) $row['period']] : null;
    }
}
