<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
  body { font-family:'DejaVu Sans', Arial, sans-serif; font-size:10pt; color:#222; padding:30px; }
  h1 { font-size:16pt; } .stamp { color:#C03A3A; font-weight:bold; border:2px solid #C03A3A; display:inline-block; padding:4px 10px; margin:10px 0; }
  td { padding:5px 8px; border-bottom:1px solid #ddd; }
</style></head>
<body>
  <h1>Consumer report (sample)</h1>
  <div class="stamp">TEST PROVIDER: NOT A REAL BACKGROUND CHECK</div>
  <p>This sample stands in for the screening company's full report while Shipmater is tested without a real provider.</p>
  <table>
    <tr><td>Candidate</td><td>{{ $check?->user?->name }}</td></tr>
    <tr><td>Report ID</td><td>{{ $reportId }}</td></tr>
    <tr><td>Package</td><td>{{ $check?->package }}</td></tr>
    <tr><td>Result</td><td>{{ $check?->status }}</td></tr>
    <tr><td>Completed</td><td>{{ $check?->completed_at?->toDayDateTimeString() }}</td></tr>
  </table>
</body></html>
