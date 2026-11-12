/** Customer-facing carrier profile validation (matches Resources Manual matrices). */

import {
  blank,
  looksLikeEmail,
  looksLikeNationalPhone,
  looksLikePhone,
  isAdultDob,
} from '@/lib/profile-field-formats';

export type CarrierProfileTabId =
  | 'personal'
  | 'services'
  | 'certifications'
  | 'insurance'
  | 'medical'
  | 'financial'
  | 'background'
  | 'vehicles'
  | 'dot'
  | 'reviews';

export interface CarrierValidationIssue {
  id: string;
  tab: CarrierProfileTabId;
  field: string;
  message: string;
  blocking: boolean;
}

export interface CarrierProfileValidationInput {
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  /** From API ServiceTypeRules.required_fields */
  requiredFields?: string[];
  autoPolicyNumber?: string;
  cargoPolicyNumber?: string;
  companyName?: string;
  dotNumber?: string;
  mcNumber?: string;
  cdlNumber?: string;
  cdlClass?: string;
  hazmatEndorsement?: boolean;
  vehicleCount?: number;
}

/** Maps backend required_fields keys → banner tab + label. */
const REQUIRED_FIELD_META: Record<
  string,
  { tab: CarrierProfileTabId; field: string; message: string; get: (p: CarrierProfileValidationInput) => string | boolean | undefined }
> = {
  auto_policy_number: {
    tab: 'insurance',
    field: 'Auto policy number',
    message: 'Auto liability policy number is required on the Insurance tab for your selected services.',
    get: (p) => p.autoPolicyNumber,
  },
  cargo_policy_number: {
    tab: 'insurance',
    field: 'Cargo policy number',
    message: 'Cargo policy number is required on the Insurance tab for your selected services.',
    get: (p) => p.cargoPolicyNumber,
  },
  company_name: {
    tab: 'personal',
    field: 'Company name',
    message: 'Company name is required for your selected services (save on Personal or Commercial).',
    get: (p) => p.companyName,
  },
  dot_number: {
    tab: 'dot',
    field: 'USDOT number',
    message: 'USDOT number is required on the Commercial tab for your selected services.',
    get: (p) => p.dotNumber,
  },
  mc_number: {
    tab: 'dot',
    field: 'MC number',
    message: 'MC number is required on the Commercial tab for your selected services.',
    get: (p) => p.mcNumber,
  },
  cdl_number: {
    tab: 'dot',
    field: 'CDL number',
    message: 'CDL number is required on the Commercial tab for your selected services.',
    get: (p) => p.cdlNumber,
  },
  cdl_class: {
    tab: 'dot',
    field: 'CDL class',
    message: 'CDL class is required on the Commercial tab for your selected services.',
    get: (p) => p.cdlClass,
  },
  hazmat_endorsement: {
    tab: 'dot',
    field: 'HazMat endorsement',
    message: 'HazMat endorsement must be enabled on the Commercial tab for your selected services.',
    get: (p) => p.hazmatEndorsement,
  },
};

function splitName(name?: string) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    first: parts[0] ?? '',
    last: parts.length > 1 ? parts[parts.length - 1] : '',
  };
}

/**
 * Banner issues: always-required Personal fields + service-type required fields.
 * Stripe Identity / background check / FMCSA / fee messages toast on click — not listed here.
 */
export function collectCarrierFieldIssues(p: CarrierProfileValidationInput): CarrierValidationIssue[] {
  const issues: CarrierValidationIssue[] = [];
  const fromName = splitName(p.name);
  const first = (p.firstName ?? fromName.first).trim();
  const last = (p.lastName ?? fromName.last).trim();

  if (blank(first)) {
    issues.push({
      id: 'first_name',
      tab: 'personal',
      field: 'First name',
      message: 'First name is required on the Personal tab.',
      blocking: true,
    });
  }
  if (blank(last)) {
    issues.push({
      id: 'last_name',
      tab: 'personal',
      field: 'Last name',
      message: 'Last name is required on the Personal tab (needed for background check).',
      blocking: true,
    });
  }
  if (blank(p.email)) {
    issues.push({
      id: 'email',
      tab: 'personal',
      field: 'Email',
      message: 'Email is required on the Personal tab.',
      blocking: true,
    });
  } else if (!looksLikeEmail(p.email)) {
    issues.push({
      id: 'email_format',
      tab: 'personal',
      field: 'Email',
      message: 'Enter a valid email (for example you@company.com) on the Personal tab.',
      blocking: true,
    });
  }
  if (blank(p.phone)) {
    issues.push({
      id: 'phone',
      tab: 'personal',
      field: 'Phone',
      message: 'Phone number is required on the Personal tab.',
      blocking: true,
    });
  } else if (!looksLikeNationalPhone(p.phone) && !looksLikePhone(p.phone)) {
    issues.push({
      id: 'phone_format',
      tab: 'personal',
      field: 'Phone',
      message: 'Enter a valid phone number (local digits) on the Personal tab.',
      blocking: true,
    });
  }
  if (blank(p.dateOfBirth)) {
    issues.push({
      id: 'date_of_birth',
      tab: 'personal',
      field: 'Date of birth',
      message: 'Date of birth is required on the Personal tab (needed for identity and background check).',
      blocking: true,
    });
  } else if (!isAdultDob(p.dateOfBirth)) {
    issues.push({
      id: 'date_of_birth_age',
      tab: 'personal',
      field: 'Date of birth',
      message: 'You must be 18 or older. Update date of birth on the Personal tab.',
      blocking: true,
    });
  }

  // Address — needed for county-level background checks
  if (blank(p.street)) {
    issues.push({
      id: 'street',
      tab: 'personal',
      field: 'Street address',
      message: 'Street address is required on the Personal tab (needed for background check).',
      blocking: true,
    });
  }
  if (blank(p.city)) {
    issues.push({
      id: 'city',
      tab: 'personal',
      field: 'City',
      message: 'City is required on the Personal tab.',
      blocking: true,
    });
  }
  if (blank(p.state)) {
    issues.push({
      id: 'state',
      tab: 'personal',
      field: 'State',
      message: 'State is required on the Personal tab.',
      blocking: true,
    });
  }
  if (blank(p.zip)) {
    issues.push({
      id: 'zip',
      tab: 'personal',
      field: 'ZIP',
      message: 'ZIP code is required on the Personal tab.',
      blocking: true,
    });
  }

  // Service-type driven requirements (from API required_fields)
  for (const key of p.requiredFields ?? []) {
    const meta = REQUIRED_FIELD_META[key];
    if (!meta) continue;
    const val = meta.get(p);
    const missing =
      typeof val === 'boolean' ? !val : blank(val == null ? '' : String(val));
    if (missing) {
      issues.push({
        id: `req_${key}`,
        tab: meta.tab,
        field: meta.field,
        message: meta.message,
        blocking: true,
      });
    }
  }

  // At least one vehicle once services are selected
  if ((p.requiredFields?.length ?? 0) > 0 && (p.vehicleCount ?? 0) < 1) {
    issues.push({
      id: 'vehicle',
      tab: 'vehicles',
      field: 'Vehicle',
      message: 'Add at least one vehicle on the Vehicles tab before bidding.',
      blocking: true,
    });
  }

  return issues;
}

export function validateCarrierPersonalForm(form: {
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}): string | null {
  if (blank(form.first_name)) return 'First name is required.';
  if (blank(form.last_name)) return 'Last name is required.';
  if (blank(form.phone)) return 'Phone number is required.';
  if (!looksLikeNationalPhone(form.phone) && !looksLikePhone(form.phone)) {
    return 'Enter a valid phone number (local digits for your country code).';
  }
  if (blank(form.date_of_birth)) return 'Date of birth is required.';
  if (!isAdultDob(form.date_of_birth)) return 'You must be 18 or older.';
  if (blank(form.street)) return 'Street address is required.';
  if (blank(form.city)) return 'City is required.';
  if (blank(form.state)) return 'State is required.';
  if (blank(form.zip)) return 'ZIP code is required.';
  return null;
}

export function carrierPersonalFieldErrors(form: {
  first_name: string;
  last_name: string;
  phone: string;
  date_of_birth: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}): Record<string, string> {
  const next: Record<string, string> = {};
  if (blank(form.first_name)) next.first_name = 'Required';
  if (blank(form.last_name)) next.last_name = 'Required';
  if (blank(form.phone)) next.phone = 'Required';
  else if (!looksLikeNationalPhone(form.phone) && !looksLikePhone(form.phone)) {
    next.phone = 'Invalid phone format';
  }
  if (blank(form.date_of_birth)) next.date_of_birth = 'Required';
  else if (!isAdultDob(form.date_of_birth)) next.date_of_birth = 'Must be 18 or older';
  if (blank(form.street)) next.street = 'Required';
  if (blank(form.city)) next.city = 'Required';
  if (blank(form.state)) next.state = 'Required';
  if (blank(form.zip)) next.zip = 'Required';
  return next;
}

export function validateCarrierInsuranceForm(
  form: { auto_policy_number: string; cargo_policy_number: string },
  requiredFields: string[] = [],
): string | null {
  if (requiredFields.includes('auto_policy_number') && blank(form.auto_policy_number)) {
    return 'Auto liability policy number is required for your selected services.';
  }
  if (requiredFields.includes('cargo_policy_number') && blank(form.cargo_policy_number)) {
    return 'Cargo policy number is required for your selected services.';
  }
  return null;
}

export function validateCarrierCommercialForm(
  form: {
    cdl_number: string;
    cdl_class: string;
    usdot_number: string;
    mc_number: string;
    hazmat_endorsement: boolean;
  },
  requiredFields: string[] = [],
): string | null {
  if (requiredFields.includes('cdl_number') && blank(form.cdl_number)) {
    return 'CDL number is required for your selected services.';
  }
  if (requiredFields.includes('cdl_class') && blank(form.cdl_class)) {
    return 'CDL class is required for your selected services.';
  }
  if (requiredFields.includes('dot_number') && blank(form.usdot_number)) {
    return 'USDOT number is required for your selected services.';
  }
  if (requiredFields.includes('mc_number') && blank(form.mc_number)) {
    return 'MC number is required for your selected services.';
  }
  if (requiredFields.includes('hazmat_endorsement') && !form.hazmat_endorsement) {
    return 'HazMat endorsement is required for your selected services.';
  }
  return null;
}

export function validateCarrierVehicleForm(form: {
  year: string;
  make: string;
  model: string;
  vin: string;
}): string | null {
  const vin = form.vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!vin) return 'Enter the VIN.';
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return 'A VIN is 17 letters and numbers (no I, O or Q).';
  if (blank(form.year)) return 'Vehicle year is required.';
  if (blank(form.make)) return 'Vehicle make is required.';
  if (blank(form.model)) return 'Vehicle model is required.';
  return null;
}

/** Preconditions for a background check — first + last name and adult DOB. */
export function backgroundPrereqError(form: {
  first_name: string;
  last_name: string;
  date_of_birth: string;
}): string | null {
  if (blank(form.first_name) || blank(form.last_name)) {
    return 'Complete first and last name on the Personal tab before running a background check.';
  }
  if (blank(form.date_of_birth)) {
    return 'Save your date of birth on the Personal tab before running a background check.';
  }
  if (!isAdultDob(form.date_of_birth)) {
    return 'You must be 18 or older to run a background check.';
  }
  return null;
}

export { looksLikeEmail, looksLikeNationalPhone, looksLikePhone, isAdultDob };
