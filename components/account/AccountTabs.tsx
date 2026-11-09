'use client';

/** The tab bar used on Profile and Company pages (same look as the shipper account pages) */
export function AccountTabs<T extends string>({ tabs, active, onSelect }: {
  tabs: { id: T; label: string; icon: React.ElementType }[]; active: T; onSelect: (id: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-2xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-1.5">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => onSelect(id)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[length:var(--text-nav)] font-semibold transition-all ${
            active === id ? 'bg-[var(--color-slate)] text-white shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}>
          <Icon size={14} />{label}
        </button>
      ))}
    </div>
  );
}
