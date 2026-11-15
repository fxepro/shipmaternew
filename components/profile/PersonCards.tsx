'use client';

import type { ReactNode } from 'react';
import { DataCard, Pill, fmtDate, expiryPill, type DataRow } from '@/components/profile/DataCard';
import { getCountry } from '@/lib/countries';

/**
 * The person's own Profile cards (Personal and Driving credentials), shown the same way to the person
 * (/carrier/profile) and to Shipmater staff (/admin/people/{id}). Both read the same profile payload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PersonProfile = Record<string, any>;

const mask = (s?: string | null) => (s ? `•••• ${String(s).slice(-4)}` : null);

/** verify: what to show when identity isn't verified yet (the person gets a Verify button) */
export function PersonalCards({ profile, verify }: { profile: PersonProfile; verify?: ReactNode }) {
  return (
    <div className="space-y-4">
      <DataCard title="Name and contact" rows={[
        ['Legal name', profile.name],
        ['Email', profile.email],
        ['Phone', profile.phone ? `${getCountry(profile.phone_country_code || 'US').dialCode} ${profile.phone}` : null],
        ['WhatsApp', profile.whatsapp ? `${getCountry(profile.whatsapp_country_code || profile.phone_country_code || 'US').dialCode} ${profile.whatsapp}` : null],
        ['Company / DBA name', profile.company_name],
        ['Date of birth', fmtDate(profile.date_of_birth)],
      ]} />
      <DataCard title="Home address" rows={[
        ['Street', profile.street], ['City', profile.city], ['State', profile.state], ['ZIP code', profile.zip],
      ]} />
      <DataCard title="Government ID" rows={[
        ['ID type', profile.id_type === 'passport' ? 'Passport' : profile.id_type === 'cdl' ? 'CDL (the same card as Driving credentials)' : "Driver's license"],
        ...(profile.id_type !== 'passport' ? [
          ['Number', mask(profile.id_type === 'cdl' ? profile.cdl_number : profile.dl_number)],
          ['Issuing state', profile.id_type === 'cdl' ? profile.cdl_issuing_state : profile.dl_state],
          ['Expires', expiryPill(profile.id_type === 'cdl' ? profile.cdl_expiry_date : profile.dl_expiry)],
        ] as DataRow[] : []),
        ['SSN (last 4)', profile.has_ssn_last_4 ? 'On file (encrypted)' : null],
        ['Identity verification', profile.identity_verified
          ? <Pill tone="good">Verified{profile.identity_verified_at ? ` ${fmtDate(profile.identity_verified_at)}` : ''}</Pill>
          : (verify ?? 'Not verified')],
      ]} />
    </div>
  );
}

export function DrivingCards({ profile }: { profile: PersonProfile }) {
  return (
    <>
      <DataCard title="Commercial driver's license (CDL)" rows={[
        ['CDL number', mask(profile.cdl_number)],
        ['Class', profile.cdl_number && profile.cdl_class ? `Class ${profile.cdl_class}` : null],
        ['Issuing state', profile.cdl_issuing_state],
        ['Expires', expiryPill(profile.cdl_expiry_date)],
        ['Also my government ID', profile.id_type === 'cdl' ? 'Yes' : 'No'],
      ]} />
      <DataCard title="Endorsements" subtitle="Used to match loads. H and N together count as X (tank + hazmat)." rows={[
        ['H — Hazardous materials', profile.hazmat_endorsement
          ? <span className="inline-flex items-center gap-2">Yes{profile.hazmat_expiry_date && <> · expires {expiryPill(profile.hazmat_expiry_date)}</>}</span> : 'No'],
        ['N — Tank vehicle', profile.tanker_endorsement ? 'Yes' : 'No'],
        ['P — Passenger', profile.passenger_endorsement ? 'Yes' : 'No'],
        ['T — Double / triple trailers', profile.doubles_triples_endorsement ? 'Yes' : 'No'],
        ['S — School bus', profile.school_bus_endorsement ? 'Yes' : 'No'],
      ]} />
      <DataCard title="DOT medical card and drug testing" rows={[
        ['Medical examiner', profile.medical_examiner_name],
        ['Medical card expires', expiryPill(profile.dot_medical_expiry)],
        ['Last drug test', fmtDate(profile.drug_test_date)],
        ['Result', profile.drug_test_date && profile.drug_test_result ? profile.drug_test_result.charAt(0).toUpperCase() + profile.drug_test_result.slice(1) : null],
      ]} />
    </>
  );
}
