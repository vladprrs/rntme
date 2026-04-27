/**
 * Canonical Deal fixtures. Covers the full Deal.qualification × Deal.status matrix
 * for Lead/Deal Schism resolution scenarios.
 */

export const newLeadFields = {
  // UNQUALIFIED + OPEN — what SF/Pipedrive call a "Lead", what amoCRM Lead also is
  // (after canonical mapping). HubSpot lifecyclestage = "subscriber" / "lead".
  name: 'Inbound: pricing inquiry',
  qualification: 1, // UNQUALIFIED
  amount: 0,
  currency: 'USD',
};

export const qualifiedDealFields = {
  // QUALIFIED + OPEN — classic mid-pipeline Deal/Opportunity.
  name: 'Acme Q4 contract',
  qualification: 2, // QUALIFIED
  amount: 50_000,
  currency: 'USD',
};

export const wonDealFields = {
  // QUALIFIED + WON — closed-won. Used in DealClosed event scenarios.
  name: 'Globex Pro license',
  qualification: 2,
  amount: 75_000,
  currency: 'USD',
  close_reason: 'Q4 budget approved',
};

export const lostDealFields = {
  // QUALIFIED + LOST — closed-lost. close_reason populated.
  name: 'Initech expansion',
  qualification: 2,
  amount: 25_000,
  currency: 'EUR',
  close_reason: 'Selected competitor',
};

export const disqualifiedDealFields = {
  // DISQUALIFIED + DELETED-or-LOST — used in negative scenarios.
  name: 'Spam inquiry',
  qualification: 3,
  amount: 0,
  currency: 'USD',
};
