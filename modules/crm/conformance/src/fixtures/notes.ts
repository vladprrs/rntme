/**
 * Canonical Note fixtures. Single-parent invariant — every note belongs to
 * exactly one Contact / Company / Deal / Activity.
 */

export const dealNoteFields = {
  content: 'Customer mentioned interest in the new pricing tier. Needs CFO sign-off by Q4 close.',
  title: 'Pricing follow-up',
  // parent: { entity_type: 'deal', canonical_id: '...' } — wired at scenario time
};

export const contactNoteFields = {
  content: 'Alice prefers email contact. Best time: 9-11am Pacific.',
  // parent: { entity_type: 'contact', canonical_id: '...' }
};

export const companyNoteFields = {
  content: 'Acme legal review takes 2-3 weeks; factor into close-date estimates.',
  // parent: { entity_type: 'company', canonical_id: '...' }
};

/**
 * Note with HTML content. Modules receiving `metadata.public.content_type=text/html`
 * MUST preserve the markup; modules without HTML support MUST round-trip as plain
 * text (HubSpot Engagements support HTML; Bitrix24 timeline-comments support a
 * subset; amoCRM Notes are plain text).
 */
export const htmlNoteFields = {
  content: '<p>Customer wants <strong>multi-year</strong> commitment.</p>',
  metadata: { public: { fields: { content_type: { stringValue: 'text/html' } } } },
};
