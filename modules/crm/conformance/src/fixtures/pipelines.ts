/**
 * Pipeline fixtures used by ListPipelines and pipeline-aware scenarios.
 * The mock-vendor returns these as if it were a vendor pipeline configuration.
 */

export const salesPipeline = {
  canonical_id: 'pl_sales',
  vendor_id: 'b24_category_0',
  name: 'Sales pipeline',
  entity_type: 'deal',
  is_default: true,
  stages: [
    { canonical_id: 'st_new', vendor_id: 'NEW', name: 'New', order: 0, semantic: 1, probability: 0.1, is_terminal: false },
    { canonical_id: 'st_qualified', vendor_id: 'QUALIFIED', name: 'Qualified', order: 10, semantic: 1, probability: 0.3, is_terminal: false },
    { canonical_id: 'st_negotiation', vendor_id: 'NEGOTIATION', name: 'Negotiation', order: 20, semantic: 1, probability: 0.6, is_terminal: false },
    { canonical_id: 'st_won', vendor_id: 'WON', name: 'Closed Won', order: 99, semantic: 2, probability: 1.0, is_terminal: true },
    { canonical_id: 'st_lost', vendor_id: 'LOST', name: 'Closed Lost', order: 99, semantic: 3, probability: 0.0, is_terminal: true },
  ],
};

/** Second pipeline for cross-pipeline UpdateDeal scenarios. */
export const partnerPipeline = {
  canonical_id: 'pl_partner',
  vendor_id: 'b24_category_1',
  name: 'Partner channel',
  entity_type: 'deal',
  is_default: false,
  stages: [
    { canonical_id: 'st_partner_intro', vendor_id: 'P_INTRO', name: 'Intro', order: 0, semantic: 1, probability: 0.2, is_terminal: false },
    { canonical_id: 'st_partner_signed', vendor_id: 'P_SIGNED', name: 'Signed', order: 50, semantic: 2, probability: 1.0, is_terminal: true },
  ],
};
