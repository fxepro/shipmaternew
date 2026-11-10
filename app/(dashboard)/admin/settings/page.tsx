'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, Plug, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { feesApi, adminFinanceApi, backgroundApi, kybApi, ratesApi, platformModeApi } from '@/lib/api';
import { Card } from '@/components/admin/DetailParts';

interface Tier { key: string; label: string; max_annual_value: number | null; monthly_price: number }
interface Fees { standard_rate: number; early_rate: number; onboarding_fee: number; complete_fee: number; tiers: Tier[] }

const inputCls = 'w-full bg-[var(--color-white)] border border-[var(--color-cream-dark)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-teal)]';
const labelCls = 'mb-1 block text-xs font-medium text-[var(--color-text-muted)]';

function errorMessage(e: unknown): string {
  const d = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  return Object.values(d?.errors ?? {})[0]?.[0] ?? d?.message ?? 'Could not save';
}

/** Platform settings → Fees (docs/fees-and-billing.md). Load fees are paid by the carrier. */
export default function AdminPlatformSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['fees'], queryFn: () => feesApi.get().then((r) => r.data.data as Fees) });

  // Percentages are edited as whole numbers (10 = 10%)
  const [standard, setStandard] = useState('');
  const [early, setEarly] = useState('');
  const [onboarding, setOnboarding] = useState('');
  const [complete, setComplete] = useState('');
  const [tiers, setTiers] = useState<Tier[]>([]);

  useEffect(() => {
    if (!data) return;
    setStandard(String(+(data.standard_rate * 100).toFixed(3)));
    setEarly(String(+(data.early_rate * 100).toFixed(3)));
    setOnboarding(String(data.onboarding_fee));
    setComplete(String(data.complete_fee ?? 99));
    setTiers(data.tiers);
  }, [data]);

  const save = useMutation({
    mutationFn: () => feesApi.update({
      standard_rate:  Number(standard) / 100,
      early_rate:     Number(early) / 100,
      onboarding_fee: Number(onboarding),
      complete_fee:   Number(complete),
      tiers: tiers.map((t, i) => ({ ...t, key: t.key || `tier${i + 1}`, max_annual_value: i === tiers.length - 1 ? null : Number(t.max_annual_value), monthly_price: Number(t.monthly_price) })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fees'] }); toast.success('Fees saved'); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const [tab, setTab] = useState<'fees' | 'background' | 'verification' | 'rates'>('fees');

  const setTier = (i: number, patch: Partial<Tier>) => setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <h1 className="page-title">Platform Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Changes apply to new loads, subscriptions and checks from the moment you save.</p>
      </div>

      <PlatformModeSwitch />

      <div role="tablist" className="inline-flex overflow-hidden rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
        {([['fees', 'Fees'], ['background', 'Background checks'], ['verification', 'Verification'], ['rates', 'Rate card']] as const).map(([k, label], i) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold ${i > 0 ? 'border-l border-[var(--color-cream-dark)]' : ''} ${tab === k ? 'bg-[var(--color-teal)] text-white' : 'text-[var(--color-text)] hover:bg-[var(--color-cream)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {(tab === 'fees' || tab === 'background') && (isLoading ? <div className="skeleton h-96 rounded-xl" /> : (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
          {tab === 'fees' && <Card title="Load fees (paid by the carrier)">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block"><span className={labelCls}>Standard fee (%)</span>
                <input type="number" step="0.01" min="0" max="50" value={standard} onChange={(e) => setStandard(e.target.value)} className={inputCls} /></label>
              <label className="block"><span className={labelCls}>Early-payment fee (%)</span>
                <input type="number" step="0.01" min="0" max="50" value={early} onChange={(e) => setEarly(e.target.value)} className={inputCls} /></label>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-faint)]">
              Every load is charged the standard fee, taken from the shipper's payment before the carrier is paid. The early-payment fee applies when the shipper pays before pickup. On factored loads the carrier is charged the standard fee when the factor marks the load funded.
            </p>
          </Card>}

          {tab === 'background' && <Card title="Background check prices (per person, one-time)">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="block"><span className={labelCls}>Basic check ($) — carrier pays</span>
                <input type="number" step="1" min="0" value={onboarding} onChange={(e) => setOnboarding(e.target.value)} className={inputCls} /></label>
              <label className="block"><span className={labelCls}>Complete check ($)</span>
                <input type="number" step="1" min="0" value={complete} onChange={(e) => setComplete(e.target.value)} className={inputCls} /></label>
              <label className="block"><span className={labelCls}>Upgrade after Basic ($)</span>
                <input value={Math.max(0, Number(complete) - Number(onboarding)) || 0} disabled className={`${inputCls} opacity-60`} /></label>
            </div>
            <p className="mt-3 text-xs text-[var(--color-text-faint)]">
              The carrier owner and every driver need the Basic check. The Complete check adds county records, the driving record and the Clearinghouse query; the carrier, or a shipper with an active contract with the carrier, pays it. Someone who passed Basic pays only the difference.
            </p>
          </Card>}

          {tab === 'fees' && <Card title="Shipper subscription tiers">
            <p className="mb-3 text-sm text-[var(--color-text-muted)]">Priced by the yearly load value a shipper states at signup; re-tiered on actual value after 12 months.</p>
            <div className="space-y-2">
              <div className="hidden grid-cols-[1fr_1fr_1fr_auto] gap-3 sm:grid">
                <span className={labelCls}>Label</span><span className={labelCls}>Up to ($ a year)</span><span className={labelCls}>Price ($ a month)</span><span className="w-8" />
              </div>
              {tiers.map((t, i) => {
                const last = i === tiers.length - 1;
                return (
                  <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <input value={t.label} onChange={(e) => setTier(i, { label: e.target.value })} aria-label="Tier label" className={inputCls} />
                    {last ? (
                      <input value="No upper limit" disabled aria-label="Upper limit" className={`${inputCls} opacity-60`} />
                    ) : (
                      <input type="number" min="0" value={t.max_annual_value ?? ''} onChange={(e) => setTier(i, { max_annual_value: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Upper limit" className={inputCls} />
                    )}
                    <input type="number" min="0" step="1" value={t.monthly_price} onChange={(e) => setTier(i, { monthly_price: Number(e.target.value) })} aria-label="Monthly price" className={inputCls} />
                    <button type="button" onClick={() => setTiers((ts) => ts.filter((_, j) => j !== i))} disabled={tiers.length <= 1}
                      title="Remove tier" className="flex w-8 items-center justify-center text-[var(--color-text-faint)] hover:text-red-500 disabled:opacity-30"><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
            <button type="button" onClick={() => setTiers((ts) => [...ts.slice(0, -1), { key: '', label: 'New tier', max_annual_value: 0, monthly_price: 0 }, ...ts.slice(-1)])}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--color-teal)] hover:underline"><Plus size={12} /> Add tier</button>
          </Card>}

          <button type="submit" disabled={save.isPending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {tab === 'fees' ? 'Save fees' : 'Save prices'}
          </button>
        </form>
      ))}

      {tab === 'fees' && <PaymentRouting />}
      {tab === 'background' && <BackgroundCheckSettings />}
      {tab === 'verification' && <><BusinessVerificationSettings /><KybCountrySettings /></>}
      {tab === 'rates' && <RateCheckSettings />}
    </div>
  );
}

/** Where load payments land: straight to the payee (default) or through Shipmater's account (docs/fees-and-billing.md) */
function PaymentRouting() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['payment-settings'], queryFn: () => adminFinanceApi.settings().then((r) => r.data.data as { flow: 'direct' | 'platform'; driver: string }) });
  const update = useMutation({
    mutationFn: (flow: 'direct' | 'platform') => adminFinanceApi.updateSettings(flow),
    onSuccess: () => { toast.success('Payment routing saved. Applies to payments scheduled from now on.'); qc.invalidateQueries({ queryKey: ['payment-settings'] }); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const options = [
    { id: 'direct' as const, title: 'Direct to the carrier or factor', text: "The shipper's payment lands in the payee's own Stripe account. Shipmater receives only its fee. Refunds and chargebacks belong to the payee." },
    { id: 'platform' as const, title: 'Through Shipmater', text: "The full payment passes through Shipmater's Stripe account and is sent on to the payee less the fee. Shows total volume on Shipmater's books; Shipmater carries refund and chargeback liability." },
  ];

  return (
    <Card title="Load payment routing">
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => (
          <button key={o.id} type="button" disabled={update.isPending || !data} onClick={() => { if (data?.flow !== o.id && confirm(`Switch load payments to "${o.title}"?`)) update.mutate(o.id); }}
            className={`rounded-xl border p-4 text-left ${data?.flow === o.id ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]'}`}>
            <p className="text-sm font-semibold">{o.title}{data?.flow === o.id && <span className="ml-2 text-xs font-medium text-[var(--color-teal)]">Current</span>}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{o.text}</p>
          </button>
        ))}
      </div>
      {data?.driver === 'fake' && <p className="mt-3 text-xs font-medium text-amber-700">Test mode: this server makes no Stripe calls for load payments.</p>}
    </Card>
  );
}

interface BgProvider { key: string; name: string; test_ready: boolean; live_ready: boolean; webhook: string | null; connected: boolean }
interface BgPackages { basic: string; full: string; upgrade: string }
interface BgSettings { provider: string; mode: 'test' | 'live'; packages: Record<string, BgPackages>; providers: BgProvider[]; live_allowed: boolean }

/** Which background check provider runs new checks, in test or live mode, and its package for each level. Keys stay on the server. */
function BackgroundCheckSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['background-settings'], queryFn: () => backgroundApi.settings().then((r) => r.data.data as BgSettings) });
  const [form, setForm] = useState<Pick<BgSettings, 'provider' | 'mode' | 'packages'> | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => { if (data) setForm({ provider: data.provider, mode: data.mode, packages: data.packages }); }, [data]);

  const save = useMutation({
    mutationFn: () => backgroundApi.updateSettings(form as Record<string, unknown>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['background-settings'] }); toast.success('Background check settings saved. New checks use them from now on.'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: () => backgroundApi.test(form!.provider).then((r) => r.data as { ok: boolean; message: string }),
    onSuccess: setTestResult,
    onError: (e) => setTestResult({ ok: false, message: errorMessage(e) }),
  });

  if (!data || !form) return <div className="skeleton h-64 rounded-xl" />;
  const current = data.providers.find((p) => p.key === form.provider);
  const pk = form.packages[form.provider] ?? { basic: '', full: '', upgrade: '' };
  const setPk = (patch: Partial<BgPackages>) => setForm({ ...form, packages: { ...form.packages, [form.provider]: { ...pk, ...patch } } });

  return (
    <Card title="Background checks">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {data.providers.map((p) => (
            <button key={p.key} type="button" onClick={() => { setForm({ ...form, provider: p.key }); setTestResult(null); }}
              className={`rounded-xl border p-3 text-left ${form.provider === p.key ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]'}`}>
              <p className="text-sm font-semibold">{p.name}{data.provider === p.key && <span className="ml-2 text-xs font-medium text-[var(--color-teal)]">Current</span>}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {!p.connected ? 'Not connected yet: waiting for the provider\'s API documents.'
                  : p.key === 'fake' ? 'Local testing only. Never offered on the live site.'
                  : `Test key ${p.test_ready ? 'set' : 'missing'} · Live key ${p.live_ready ? 'set' : 'missing'}`}
              </p>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {current?.webhook && (
            <div>
              <span className={labelCls}>Webhook address (paste into the provider's dashboard)</span>
              <div className="flex gap-2">
                <input value={current.webhook} readOnly className={`${inputCls} font-mono text-xs`} />
                <button type="button" title="Copy" className="px-2 text-[var(--color-text-faint)] hover:text-[var(--color-teal)]"
                  onClick={() => navigator.clipboard.writeText(current.webhook!).then(() => toast.success('Copied'))}><Copy size={14} /></button>
              </div>
            </div>
          )}
        </div>

        <div>
          <span className={labelCls}>Packages on {current?.name ?? form.provider} (the provider's package names)</span>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="text-xs text-[var(--color-text-faint)]">Basic</span>
              <input value={pk.basic} onChange={(e) => setPk({ basic: e.target.value })} className={inputCls} /></label>
            <label className="block"><span className="text-xs text-[var(--color-text-faint)]">Complete (from scratch)</span>
              <input value={pk.full} onChange={(e) => setPk({ full: e.target.value })} className={inputCls} /></label>
            <label className="block"><span className="text-xs text-[var(--color-text-faint)]">Upgrade after Basic (optional)</span>
              <input value={pk.upgrade} onChange={(e) => setPk({ upgrade: e.target.value })} placeholder="Uses Complete if empty" className={inputCls} /></label>
          </div>
        </div>

        {testResult && <p className={`text-xs ${testResult.ok ? 'text-emerald-700' : 'text-[var(--color-danger)]'}`}>{testResult.message}</p>}

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save background check settings
          </button>
          <button type="button" onClick={() => test.mutate()} disabled={test.isPending}
            className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-teal)] hover:underline disabled:opacity-60">
            {test.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Test connection
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-faint)]">Checks already sent to a provider finish there. Switching provider affects new checks only. API keys are set on the server and never shown here.</p>
      </div>
    </Card>
  );
}

interface KybProvider { key: string; name: string; test_ready: boolean; live_ready: boolean; webhook: string | null }
interface KybSettings { provider: string; mode: 'test' | 'live'; countries: string[]; all_countries: { code: string; name: string; lite: boolean; blocked: boolean }[]; didit_ready: boolean; providers: KybProvider[]; live_allowed: boolean; sam_gov_ready: boolean; fmcsa_ready: boolean }

/**
 * Which provider verifies businesses (EIN, Secretary of State, address, OFAC) for shippers, brokers and factors,
 * in test or live mode. Results arrive by webhook (demo/compliance-checks.html). Keys stay on the server.
 */
function BusinessVerificationSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['kyb-settings'], queryFn: () => kybApi.settings().then((r) => r.data.data as KybSettings) });
  const [form, setForm] = useState<{ provider: string; mode: 'test' | 'live' } | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  useEffect(() => { if (data) setForm({ provider: data.provider, mode: data.mode }); }, [data]);

  const save = useMutation({
    mutationFn: () => kybApi.updateSettings(form!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kyb-settings'] }); toast.success('Business verification settings saved. New checks use them from now on.'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const test = useMutation({
    mutationFn: () => kybApi.test(form!.provider).then((r) => r.data as { ok: boolean; message: string }),
    onSuccess: setTestResult,
    onError: (e) => setTestResult({ ok: false, message: errorMessage(e) }),
  });

  if (!data || !form) return <div className="skeleton h-48 rounded-xl" />;
  const current = data.providers.find((p) => p.key === form.provider);

  return (
    <Card title="Business verification">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Checks a shipper, broker or factor&apos;s EIN with the IRS, its Secretary of State registration, its address and the OFAC sanctions list.
          It runs on its own once the legal name, EIN and address are filled in, and again when they change.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.providers.map((p) => (
            <button key={p.key} type="button" onClick={() => { setForm({ ...form, provider: p.key }); setTestResult(null); }}
              className={`rounded-xl border p-3 text-left ${form.provider === p.key ? 'border-[var(--color-teal)] bg-[var(--color-teal-pale)]' : 'border-[var(--color-cream-dark)] hover:border-[var(--color-teal)]'}`}>
              <p className="text-sm font-semibold">{p.name}{data.provider === p.key && <span className="ml-2 text-xs font-medium text-[var(--color-teal)]">Current</span>}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {p.key === 'fake' ? 'Local testing only. Answers at once; never offered on the live site.'
                  : `Test key ${p.test_ready ? 'set' : 'missing'} · Live key ${p.live_ready ? 'set' : 'missing'}`}
              </p>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {current?.webhook && (
            <div>
              <span className={labelCls}>Webhook address (add it in the provider&apos;s dashboard)</span>
              <div className="flex gap-2">
                <input value={current.webhook} readOnly className={`${inputCls} font-mono text-xs`} />
                <button type="button" title="Copy" className="px-2 text-[var(--color-text-faint)] hover:text-[var(--color-teal)]"
                  onClick={() => navigator.clipboard.writeText(current.webhook!).then(() => toast.success('Copied'))}><Copy size={14} /></button>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg bg-[var(--color-cream)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          Public registers: FMCSA key {data.fmcsa_ready ? 'set' : 'missing'} (USDOT, MC, broker authority, insurance and bond) ·
          SAM.gov key {data.sam_gov_ready ? 'set' : 'missing'} (government registration) · NHTSA VIN decoder needs no key.
        </div>

        {testResult && <p className={`text-xs ${testResult.ok ? 'text-emerald-700' : 'text-[var(--color-danger)]'}`}>{testResult.message}</p>}

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save business verification settings
          </button>
          <button type="button" onClick={() => test.mutate()} disabled={test.isPending}
            className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-teal)] hover:underline disabled:opacity-60">
            {test.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plug size={13} />} Test connection
          </button>
        </div>
        <p className="text-xs text-[var(--color-text-faint)]">API keys are set on the server (MIDDESK_TEST_KEY, MIDDESK_LIVE_KEY, MIDDESK_WEBHOOK_SECRET, SAM_GOV_API_KEY) and never shown here.</p>
      </div>
    </Card>
  );
}

type RateSettings = { per_mile: Record<string, number>; min_charge: number | null; spread_pct: number | null; hazmat_pct: number | null; temp_pct: number | null; extra_stop: number | null; fuel_base_price: number | null; fuel_mpg: number | null };
type RateNumberKey = Exclude<keyof RateSettings, 'per_mile'>;

/** The numbers behind Rate check (api/app/Services/Rates/RateEstimator.php). Nothing is estimated until a per-mile rate is set. */
function RateCheckSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['rate-settings'],
    queryFn: () => ratesApi.settings().then((r) => ({ settings: r.data.data as RateSettings, equipment: r.data.equipment as { key: string; name: string }[] })),
  });
  const [form, setForm] = useState<RateSettings | null>(null);
  useEffect(() => { if (data) setForm({ ...data.settings, per_mile: { ...(Array.isArray(data.settings.per_mile) ? {} : data.settings.per_mile) } }); }, [data]);

  const save = useMutation({
    mutationFn: () => ratesApi.saveSettings(form!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rate-settings'] }); toast.success('Rate check settings saved.'); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!data || !form) return <div className="skeleton h-48 rounded-xl" />;
  const num = (v: string) => (v === '' ? null : Number(v));
  const fields: [RateNumberKey, string][] = [
    ['min_charge', 'Minimum charge ($)'], ['spread_pct', 'Low/high spread (%)'], ['hazmat_pct', 'Hazmat (% of linehaul)'],
    ['temp_pct', 'Temperature control (%)'], ['extra_stop', 'Each extra stop ($)'], ['fuel_base_price', 'Diesel included in rates ($/gal)'], ['fuel_mpg', 'Miles per gallon'],
  ];

  return (
    <Card title="Rate check">
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          The market range shippers and brokers see before posting a load. Linehaul is road miles times the per-mile rate for the equipment.
          The fuel surcharge uses the EIA weekly diesel price above the price already in the rates. Once a lane has 5 completed loads in 120 days, their rates are blended in.
          Equipment with no rate gets no estimate.
        </p>
        <div>
          <span className={labelCls}>Per-mile rate by equipment ($/mi)</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {data.equipment.map((e) => (
              <label key={e.key} className="text-xs text-[var(--color-text-muted)]">{e.name}
                <input type="number" min="0" step="0.01" value={form.per_mile[e.key] ?? ''} className={inputCls}
                  onChange={(ev) => setForm({ ...form, per_mile: { ...form.per_mile, [e.key]: ev.target.value === '' ? (undefined as unknown as number) : Number(ev.target.value) } })} />
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {fields.map(([k, label]) => (
            <label key={k} className="text-xs text-[var(--color-text-muted)]">{label}
              <input type="number" min="0" step="0.01" value={form[k] ?? ''} className={inputCls} onChange={(e) => setForm({ ...form, [k]: num(e.target.value) })} />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save rate check settings
        </button>
        <p className="text-xs text-[var(--color-text-faint)]">The EIA key is set on the server (EIA_API_KEY). Without it there is no fuel surcharge.</p>
      </div>
    </Card>
  );
}

type ModeService = { key: string; name: string; switch: boolean; live_ready: boolean; note?: string };

/** One Test / Live switch for every outside check (api/app/Support/PlatformMode.php) */
function PlatformModeSwitch() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['platform-mode'],
    queryFn: () => platformModeApi.get().then((r) => r.data.data as { mode: 'test' | 'live'; live_allowed: boolean; services: ModeService[] }),
  });
  const save = useMutation({
    mutationFn: (mode: 'test' | 'live') => platformModeApi.save(mode),
    onSuccess: (_r, mode) => {
      ['platform-mode', 'kyb-settings', 'background-settings'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      toast.success(mode === 'live' ? 'Live mode on: new checks are real and charged.' : 'Test mode on: new checks are not real.');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data) return <div className="skeleton h-20 rounded-xl" />;
  const blocked = data.services.filter((s) => s.switch && !s.live_ready);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${data.mode === 'live' ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-[var(--color-text)]">Mode: {data.mode === 'live' ? 'Live' : 'Test'}</p>
        <p className="text-xs text-[var(--color-text-muted)]">Turns business verification and background checks to test or live together.</p>
        <ul className="text-xs text-[var(--color-text-muted)]">
          {data.services.map((s) => (
            <li key={s.key}>{s.name}: {s.note ?? (s.live_ready ? 'live key set' : 'live key missing')}</li>
          ))}
        </ul>
        {!data.live_allowed && <p className="text-xs text-[var(--color-text-faint)]">Live mode is turned off on this computer.</p>}
      </div>
      <div className="inline-flex overflow-hidden rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)]">
        {(['test', 'live'] as const).map((m, i) => (
          <button key={m} type="button" disabled={save.isPending || (m === 'live' && (!data.live_allowed || blocked.length > 0))}
            onClick={() => m !== data.mode && save.mutate(m)}
            title={m === 'live' && blocked.length ? `Live keys missing: ${blocked.map((b) => b.name).join(', ')}` : undefined}
            className={`px-4 py-2 text-sm font-semibold disabled:opacity-40 ${i > 0 ? 'border-l border-[var(--color-cream-dark)]' : ''} ${data.mode === m ? 'bg-[var(--color-teal)] text-white' : 'text-[var(--color-text)] hover:bg-[var(--color-cream)]'}`}>
            {m === 'test' ? 'Test' : 'Live'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The countries a company can be verified in (api/app/Support/KybCountries.php). Outside the US the check always goes to Didit. */
function KybCountrySettings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['kyb-settings'], queryFn: () => kybApi.settings().then((r) => r.data.data as KybSettings) });
  const [on, setOn] = useState<string[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { if (data) setOn(data.countries ?? ['US']); }, [data]);
  const save = useMutation({
    mutationFn: () => kybApi.updateSettings({ provider: data!.provider, countries: on! }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kyb-settings'] }); toast.success('Countries saved.'); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (!data || !on) return <div className="skeleton h-48 rounded-xl" />;
  const list = data.all_countries.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.code === q.toUpperCase());
  const toggle = (code: string) => setOn((xs) => (xs!.includes(code) ? xs!.filter((x) => x !== code) : [...xs!, code]));

  return (
    <Card title={`Countries (${new Set(['US', ...on]).size} on)`}>
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-text-muted)]">
          Where shippers, brokers and factors can register and be verified. Outside the US the check runs through Didit: the national company register,
          the registration or tax number and the sanctions screen. There is no IRS match or W-9. Carriers still need FMCSA authority to haul in the US.
        </p>
        {!data.didit_ready && <p className="text-xs font-medium text-amber-700">The Didit key is not set on the server, so checks outside the US will not run.</p>}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries" className={inputCls} />
        <div className="grid max-h-80 gap-1 overflow-y-auto rounded-lg border border-[var(--color-cream-dark)] p-2 sm:grid-cols-2">
          {list.map((c) => (
            <label key={c.code} className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${c.blocked ? 'opacity-40' : 'hover:bg-[var(--color-cream)]'}`}>
              <input type="checkbox" checked={c.code === 'US' || on.includes(c.code)} disabled={c.blocked || c.code === 'US'} onChange={() => toggle(c.code)} />
              <span className="text-[var(--color-text)]">{c.name}</span>
              <span className="text-xs text-[var(--color-text-faint)]">{c.code}{c.lite ? ' · no ownership records' : ''}{c.blocked ? ' · blocked' : ''}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <button type="button" className="font-semibold text-[var(--color-teal)] hover:underline" onClick={() => setOn(['US'])}>US only</button>
          <button type="button" className="font-semibold text-[var(--color-teal)] hover:underline" onClick={() => setOn(data.all_countries.filter((c) => !c.blocked).map((c) => c.code))}>Turn all on</button>
        </div>
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-navy flex items-center gap-2 disabled:opacity-60">
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save countries
        </button>
      </div>
    </Card>
  );
}
