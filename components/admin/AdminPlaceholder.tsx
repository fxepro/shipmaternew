import { type LucideIcon } from 'lucide-react';

interface AdminPlaceholderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** What this page will hold once built */
  planned: string[];
}

export function AdminPlaceholder({ icon: Icon, title, description, planned }: AdminPlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>

      <div className="rounded-xl border border-[var(--color-cream-dark)] bg-[var(--color-white)] p-6">
        <div className="flex items-center gap-3">
          <div className="empty-icon !m-0">
            <Icon size={22} style={{ color: 'var(--text-faint)' }} />
          </div>
          <div>
            <p className="font-medium" style={{ color: 'var(--text)' }}>Not built yet</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>This section is planned. It will include:</p>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
          {planned.map((p) => (
            <li key={p} className="flex gap-2"><span aria-hidden>•</span>{p}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
