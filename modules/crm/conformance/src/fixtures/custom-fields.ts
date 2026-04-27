/**
 * CustomFieldDefinition fixtures used by ListCustomFieldDefinitions scenarios.
 * Demonstrates the FieldMapping concept: vendor_key varies (UF_CRM_, __c, 40-char hash);
 * logical_name is canonical and is the data-plane key under metadata.public.
 */

export const dealPriorityField = {
  entity_type: 'deal',
  logical_name: 'priority',
  vendor_key: 'UF_CRM_2_PRIORITY', // Bitrix24 form
  field_type: 6, // ENUM
  label: 'Priority',
  is_required: false,
  options: ['low', 'normal', 'high', 'urgent'],
};

export const contactSegmentField = {
  entity_type: 'contact',
  logical_name: 'segment',
  vendor_key: 'segment__c', // SF form
  field_type: 6,
  label: 'Segment',
  is_required: false,
  options: ['enterprise', 'mid-market', 'smb'],
};

export const dealCustomerSatisfactionField = {
  entity_type: 'deal',
  logical_name: 'csat',
  vendor_key: 'a3f7c982e1b4d56abc12345f6d7e8a9b0c1d2e3f', // Pipedrive 40-char hash
  field_type: 2, // NUMBER
  label: 'CSAT score',
  is_required: false,
};

export const companyAnnualRevenueRangeField = {
  entity_type: 'company',
  logical_name: 'revenue_range',
  vendor_key: 'annual_revenue_range', // HubSpot snake_case
  field_type: 6,
  label: 'Annual Revenue Range',
  is_required: false,
  options: ['<1M', '1M-10M', '10M-100M', '100M+'],
};
