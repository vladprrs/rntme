/**
 * Association fixtures — both labeled (HubSpot v4) and emulated (Bitrix24/amoCRM/PD).
 * Used by CreateAssociation / DeleteAssociation / ListAssociations scenarios.
 */

export const billingContactLabel = 'BILLING_CONTACT';
export const decisionMakerLabel = 'DECISION_MAKER';
export const technicalContactLabel = 'TECHNICAL_CONTACT';

/** Labeled, RNTME_DEFINED — works on labeled-supporting modules only. */
export const labeledBillingFields = (fromContactId: string, toDealId: string) => ({
  from: { entity_type: 'contact', canonical_id: fromContactId },
  to: { entity_type: 'deal', canonical_id: toDealId },
  category: 1, // RNTME_DEFINED
  label: billingContactLabel,
});

/** Unlabeled — works on every module. */
export const unlabeledFields = (fromContactId: string, toDealId: string) => ({
  from: { entity_type: 'contact', canonical_id: fromContactId },
  to: { entity_type: 'deal', canonical_id: toDealId },
  category: 0, // UNSPECIFIED
  label: '',
});

/** USER_DEFINED label — tenant-custom, accepted only when labeled_associations=true. */
export const userDefinedLabelFields = (fromCompanyId: string, toContactId: string, customLabel: string) => ({
  from: { entity_type: 'company', canonical_id: fromCompanyId },
  to: { entity_type: 'contact', canonical_id: toContactId },
  category: 2, // USER_DEFINED
  label: customLabel,
});
