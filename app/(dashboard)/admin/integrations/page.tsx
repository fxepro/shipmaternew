'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy, Loader2, Plug, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { integrationsApi } from '@/lib/api';
import { DataCard, Pill, type DataRow } from '@/components/profile/DataCard';

interface Integration {
  key: string; group: string; name: string; used_for: string; cost: string;
  keys: { name: string; set: boolean }[];
  mode: 'test' | 'live' | null; in_use?: boolean; webhook: string | null; testable: boolean;
  settings?: string; note?: string | null;
}

/** Every outside service the platform uses (api/app/Support/Integrations.php). Keys are shown as set or not, never their values. */
export default function AdminIntegrationsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: () => integrationsApi.list().then((r) => r.data as { data: Integration[]; environment: string }),
  });

  const groups = (data?.data ?? []).reduce<Record<string, Integration[]>>((acc, i) => ((acc[i.group] ??= []).push(i), acc), {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Integrations</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Outside services the platform uses, whether their keys are set on this server ({data?.environment ?? '…'}), and a connection test for each.
          Keys are entered in the server&apos;s .env file, never here. Which business-verification and background-check provider is used is chosen in{' '}
          <Link href="/admin/settings" className="text-[var(--color-teal)] underline">Settings</Link>.
        </p>
      </div>

      {isLoading && <div className="skeleton h-48 rounded-xl" />}

      {Object.entries(groups).map(([group, items]) => (
        <section key={group} className="space-y-3">
          <h2 className="text-h5 text-[var(--color-text)]">{group}</h2>
          {items.map((i) => <IntegrationCard key={i.key} i={i} />)}
        </section>
      ))}
    </div>
  );
}

function IntegrationCard({ i }: { i: Integration }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const missing = i.keys.filter((k) => !k.set).length;

  const test = async () => {
    setTesting(true); setResult(null);
    try { setResult((await integrationsApi.test(i.key)).data); }
    catch { setResult({ ok: false, message: 'The test request failed.' }); }
    finally { setTesting(false); }
  };

  const status = i.keys.length === 0
    ? <Pill tone="good">No key needed</Pill>
    : missing === 0 ? <Pill tone="good">All keys set</Pill>
    : missing === i.keys.length ? <Pill tone="bad">Not set up</Pill>
    : <Pill tone="warn">{missing} of {i.keys.length} keys missing</Pill>;

  const rows: DataRow[] = [
    ['Used for', i.used_for],
    ['Status', <span key="s" className="inline-flex flex-wrap items-center gap-2">
      {status}
      {i.in_use !== undefined && (i.in_use ? <Pill tone="good">In use</Pill> : <Pill>Not in use</Pill>)}
      {i.mode && <Pill tone={i.mode === 'live' ? 'warn' : 'neutral'}>{i.mode === 'live' ? 'Live' : 'Test'} mode</Pill>}
    </span>],
    ...(i.keys.length ? [['Keys', <span key="k" className="block space-y-1">
      {i.keys.map((k) => (
        <span key={k.name} className="flex items-center gap-2">
          <code className="text-sm">{k.name}</code><Pill tone={k.set ? 'good' : 'bad'}>{k.set ? 'Set' : 'Not set'}</Pill>
        </span>
      ))}
    </span>] as DataRow] : []),
    ['Cost', i.cost],
    ...(i.webhook ? [['Webhook address', <span key="w" className="flex items-center gap-2">
      <code className="min-w-0 break-all text-sm">{i.webhook}</code>
      <button type="button" title="Copy" className="shrink-0 text-[var(--color-text-faint)] hover:text-[var(--color-teal)]"
        onClick={() => navigator.clipboard.writeText(i.webhook!).then(() => toast.success('Copied'))}><Copy size={14} /></button>
    </span>] as DataRow] : []),
    ...(i.note ? [['Note', i.note] as DataRow] : []),
    ...(result ? [['Connection test', <Pill key="t" tone={result.ok ? 'good' : 'bad'}>{result.message}</Pill>] as DataRow] : []),
  ];

  const action = (
    <span className="flex shrink-0 items-center gap-2">
      {i.settings && (
        <Link href={i.settings} className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-teal)]">
          <Settings size={14} /> Settings
        </Link>
      )}
      {i.testable && (
        <button type="button" onClick={test} disabled={testing}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--color-cream-dark)] bg-[var(--color-white)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:border-[var(--color-teal)] disabled:opacity-60">
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Test connection
        </button>
      )}
    </span>
  );

  return <DataCard title={i.name} action={action} rows={rows} />;
}
