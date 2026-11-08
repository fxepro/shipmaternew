'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { DataCard } from '@/components/profile/DataCard';
import { ChipPicker, useCatalog, nameOf } from './catalog';

/**
 * What a company is in the directory (several allowed). One row when viewing; the picker only after Edit.
 * saveUrl: the company's own endpoint or the admin one.
 */
export function CategoriesEditor({ value, saveUrl, onSaved, canEdit = true }: {
  value: string[]; saveUrl: string; onSaved?: (v: string[]) => void; canEdit?: boolean;
}) {
  const catalog = useCatalog();
  const [editing, setEditing] = useState(false);
  const [sel, setSel] = useState<string[]>(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setSel(value), [value]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.put(saveUrl, { categories: sel });
      toast.success('Categories saved');
      setEditing(false);
      onSaved?.(r.data.data.categories);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Could not save categories');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DataCard title="Directory categories" subtitle="What the company is in the Shipmater directory"
      action={canEdit && !editing ? <button onClick={() => setEditing(true)} className="text-sm font-medium text-[var(--color-teal)] hover:underline">Edit</button> : undefined}
      rows={editing ? undefined : [['Categories', value.length ? value.map((k) => nameOf(catalog.categories, k)).join(', ') : null]]}>
      {editing && (
        <div className="space-y-3 px-4 py-3">
          <ChipPicker items={catalog.categories} value={sel} onChange={setSel} grouped />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn btn-navy disabled:opacity-50">Save</button>
            <button onClick={() => { setSel(value); setEditing(false); }} className="btn border border-[var(--color-cream-dark)]">Cancel</button>
          </div>
        </div>
      )}
    </DataCard>
  );
}
