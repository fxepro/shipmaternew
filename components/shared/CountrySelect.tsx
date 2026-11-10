'use client';

import { ChevronDown } from 'lucide-react';
import { COUNTRIES } from '@/lib/countries';

interface CountrySelectProps {
  value: string;
  onChange: (code: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  id?: string;
  /** Only these country codes (e.g. the countries a company can be verified in); the current value is always kept */
  allowed?: string[];
}

export default function CountrySelect({
  value,
  onChange,
  label = 'Country',
  required = false,
  className = '',
  id = 'country',
  allowed,
}: CountrySelectProps) {
  const options = allowed ? COUNTRIES.filter(c => allowed.includes(c.code) || c.code === (value || 'US')) : COUNTRIES;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="profile-label">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      <div className="profile-select-wrap">
        <select
          id={id}
          className="profile-select"
          value={value || 'US'}
          onChange={e => onChange(e.target.value)}
        >
          {options.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
      </div>
    </div>
  );
}
