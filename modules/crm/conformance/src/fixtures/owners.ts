/**
 * Owner fixtures. Owner is CRM-local — distinct from Identity.User. These represent
 * users in the CRM vendor's namespace (Bitrix24 employees, SF Users, HubSpot Owners).
 */

export const sallySalesOwner = {
  canonical_id: 'own_sally',
  vendor_id: 'b24_user_42',
  email: 'sally@example.com',
  name: { given: 'Sally', family: 'Smith', display: 'Sally Smith' },
  is_active: true,
};

export const bobBackupOwner = {
  canonical_id: 'own_bob',
  vendor_id: 'b24_user_77',
  email: 'bob@example.com',
  name: { given: 'Bob', family: 'Backup', display: 'Bob Backup' },
  is_active: true,
};

export const carolDeactivatedOwner = {
  canonical_id: 'own_carol',
  vendor_id: 'b24_user_99',
  email: 'carol@example.com',
  name: { given: 'Carol', family: 'Carter' },
  is_active: false, // used in negative-path scenarios
};
