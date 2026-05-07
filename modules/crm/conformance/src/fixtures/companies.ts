/**
 * Canonical Company fixtures. Includes a Russian-tax-fields fixture (Bitrix24
 * INN/OGRN/KPP via Company.tax_id/registration_id/tax_branch_id) and an
 * international fixture (HubSpot/SF — empty regulatory fields).
 */

export const acmeRu = {
  name: 'Acme LLC',
  domain: 'acme.example',
  industry: 'manufacturing',
  employee_count: 250,
  annual_revenue: 5_000_000,
  currency: 'RUB',
  tax_id: '7707083893', // valid 10-char INN
  registration_id: '1027700132195', // 13-char OGRN
  tax_branch_id: '770701001', // 9-char KPP
};

export const globexInt = {
  name: 'Globex Corp',
  domain: 'globex.example',
  industry: 'tech',
  employee_count: 1500,
  annual_revenue: 50_000_000,
  currency: 'USD',
  // tax_id, registration_id, tax_branch_id intentionally empty
};

export const acmeChild = {
  name: 'Acme Operations LLC',
  domain: 'ops.acme.example',
  // parent_company_canonical_id wired at scenario time
};

/** Duplicate-domain fixture for HubSpot dedup-by-domain assertions. */
export const acmeDuplicateDomain = {
  name: 'Acme Holdings',
  domain: 'acme.example',
};
