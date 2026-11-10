'use client';

import { ChevronDown } from 'lucide-react';
import { getCountry, getSubdivisions } from '@/lib/countries';
import CountrySelect from '@/components/shared/CountrySelect';

export interface AddressValue {
  address?: string;
  street?: string;   // alias of address used in some tables
  city: string;
  state: string;
  zip: string;       // raw field name kept for API compat
  country: string;
}

interface AddressFieldsProps {
  value: AddressValue;
  onChange: (updated: AddressValue) => void;
  /** Show the top-level street/address line */
  showStreet?: boolean;
  /** Required fields — defaults to city + country */
  required?: boolean;
  className?: string;
  /** Limit the country list to these codes */
  countries?: string[];
}

export default function AddressFields({
  value,
  onChange,
  showStreet = true,
  required = false,
  className = '',
  countries,
}: AddressFieldsProps) {
  const country = getCountry(value.country || 'US');
  const subdivisions = getSubdivisions(value.country || 'US');

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });

  const streetVal = value.address ?? value.street ?? '';
  const req = required ? <span className="text-destructive ml-1">*</span> : null;

  return (
    <div className={`space-y-4 ${className}`}>
      {showStreet && (
        <div>
          <label htmlFor="addr-street" className="profile-label">
            Street Address{req}
          </label>
          <input
            id="addr-street"
            type="text"
            className="profile-input"
            value={streetVal}
            onChange={e => set({ address: e.target.value, street: e.target.value })}
            placeholder="123 Main St, Suite 4"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="addr-city" className="profile-label">
            City{req}
          </label>
          <input
            id="addr-city"
            type="text"
            className="profile-input"
            value={value.city ?? ''}
            onChange={e => set({ city: e.target.value })}
            placeholder="City"
          />
        </div>

        <div>
          <label htmlFor="addr-zip" className="profile-label">{country.postalLabel}</label>
          <input
            id="addr-zip"
            type="text"
            className="profile-input"
            value={value.zip ?? ''}
            onChange={e => set({ zip: e.target.value })}
            placeholder={country.postalLabel}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="addr-state" className="profile-label">{country.stateLabel}</label>
          {subdivisions ? (
            <div className="profile-select-wrap">
              <select
                id="addr-state"
                className="profile-select"
                value={value.state ?? ''}
                onChange={e => set({ state: e.target.value })}
              >
                <option value="">Select {country.stateLabel}</option>
                {subdivisions.map(([code, name]) => (
                  <option key={code} value={code}>{name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
            </div>
          ) : (
            <input
              id="addr-state"
              type="text"
              className="profile-input"
              value={value.state ?? ''}
              onChange={e => set({ state: e.target.value })}
              placeholder={country.stateLabel}
            />
          )}
        </div>

        <CountrySelect
          value={value.country || 'US'}
          onChange={code => set({ country: code, state: '' })}
          label="Country"
          required={required}
          id="addr-country"
          allowed={countries}
        />
      </div>
    </div>
  );
}
