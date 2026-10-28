export type ProfileTab = 'personal' | 'dot_commercial' | 'insurance' | 'medical' | 'financial' | 'background';

interface RuleSet {
  required: string[];
  recommended: string[];
  tabs: ProfileTab[];
}

const RULES: Record<string, RuleSet> = {
  // Freight & Logistics
  general_freight:   { required: ['dot_number', 'mc_number', 'company_name', 'auto_policy_number', 'cargo_policy_number'], recommended: ['cdl_number'], tabs: ['dot_commercial', 'insurance'] },
  hotshot:           { required: ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance'] },
  refrigerated:      { required: ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance'] },
  flatbed:           { required: ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance'] },
  dry_van:           { required: ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance'] },
  hazmat:            { required: ['dot_number', 'mc_number', 'cdl_number', 'hazmat_endorsement', 'auto_policy_number', 'cargo_policy_number'], recommended: ['hazmat_expiry_date'], tabs: ['dot_commercial', 'insurance', 'medical'] },

  // Auto & Vehicles
  auto_transport_open:     { required: ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance'] },
  auto_transport_enclosed: { required: ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance'] },
  rv_boat_powersports:     { required: ['dot_number', 'auto_policy_number'], recommended: ['mc_number'], tabs: ['dot_commercial', 'insurance'] },

  // Cold Chain
  cold_chain_food:   { required: ['dot_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance'] },

  // Construction & Equipment
  heavy_equipment:        { required: ['dot_number', 'mc_number', 'cdl_number', 'cdl_class', 'auto_policy_number', 'cargo_policy_number'], recommended: ['dot_medical_expiry'], tabs: ['dot_commercial', 'insurance', 'medical'] },
  construction_materials: { required: ['dot_number', 'auto_policy_number'], recommended: ['mc_number'], tabs: ['dot_commercial', 'insurance'] },
  oversized_load:         { required: ['dot_number', 'mc_number', 'cdl_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance', 'medical'] },
  crane_rigging:          { required: ['dot_number', 'mc_number', 'auto_policy_number', 'cargo_policy_number'], recommended: [], tabs: ['dot_commercial', 'insurance'] },

};

export function getRequiredFields(selectedKeys: string[]): string[] {
  const fields = new Set<string>();
  for (const key of selectedKeys) for (const f of RULES[key]?.required ?? []) fields.add(f);
  return [...fields];
}

export function getRecommendedFields(selectedKeys: string[]): string[] {
  const fields = new Set<string>();
  for (const key of selectedKeys) for (const f of RULES[key]?.recommended ?? []) fields.add(f);
  return [...fields];
}

export function getRelevantTabs(selectedKeys: string[]): ProfileTab[] {
  const tabs = new Set<ProfileTab>(['personal']);
  for (const key of selectedKeys) for (const t of RULES[key]?.tabs ?? []) tabs.add(t);
  if (selectedKeys.length > 0) { tabs.add('financial'); tabs.add('background'); }
  return [...tabs];
}

export function requiresDot(selectedKeys: string[]): boolean {
  return selectedKeys.some(k => RULES[k]?.required.includes('dot_number'));
}

export function isFieldRequired(field: string, selectedKeys: string[]): boolean {
  return getRequiredFields(selectedKeys).includes(field);
}
