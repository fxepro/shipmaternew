<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
  body { font-family:'DejaVu Sans', Arial, sans-serif; font-size:10pt; color:#0F2433; padding:24px; }
  h1 { font-size:16pt; margin:0 0 2px; } .sub { color:#5A7184; margin:0 0 14px; }
  h2 { font-size:11pt; margin:16px 0 4px; border-bottom:2px solid #0096C7; padding-bottom:3px; }
  table { width:100%; border-collapse:collapse; } td { padding:4px 6px; border-bottom:1px solid #E2ECF0; vertical-align:top; }
  td.l { color:#5A7184; width:35%; } .flag { color:#C03A3A; font-weight:bold; } .meta td { border:0; padding:2px 6px; }
  .foot { margin-top:18px; color:#5A7184; font-size:8pt; }
</style></head>
<body>
  <h1>Business report: {{ $report['company_name'] ?? $report['query'] }}</h1>
  <p class="sub">Shipmater · report #{{ $report['id'] }}</p>
  <table class="meta">
    <tr><td class="l">Searched</td><td>{{ strtoupper($report['query_type']) }} {{ $report['query'] }}{{ $report['state'] ? ' · ' . $report['state'] : '' }}</td></tr>
    <tr><td class="l">Agency</td><td>{{ $agency }}</td></tr>
    <tr><td class="l">Run by</td><td>{{ $report['run_by'] }}</td></tr>
    @if ($report['case_number'])<tr><td class="l">Case number</td><td>{{ $report['case_number'] }}</td></tr>@endif
    <tr><td class="l">Completed</td><td>{{ \Illuminate\Support\Carbon::parse($report['completed_at'])->toDayDateTimeString() }}</td></tr>
  </table>
  @foreach ($report['sections'] as $s)
    <h2>{{ $s['label'] }}</h2>
    <table>
      @forelse ($s['rows'] as $row)
        <tr><td class="l">{{ $row['label'] }}</td><td class="{{ $row['flag'] ? 'flag' : '' }}">{{ $row['value'] }}{{ $row['flag'] ? ' ⚠' : '' }}</td></tr>
      @empty
        <tr><td colspan="2">No result</td></tr>
      @endforelse
      @if (!empty($s['at']))<tr><td class="l">Checked</td><td>{{ \Illuminate\Support\Carbon::parse($s['at'])->toDayDateTimeString() }}</td></tr>@endif
    </table>
  @endforeach
  <p class="foot">Each fact is shown as its source returned it, with the time it was checked. This report is not a consumer report and must not be used for decisions about a person's credit, employment, insurance or housing.</p>
</body></html>
