/**
 * Canonical Activity fixtures spanning all 4 ActivityType enum values
 * (CALL/MEETING/TASK/EMAIL) and the M:N linked_entities[] pattern.
 */

export const followupCallFields = {
  type: 1, // CALL
  subject: 'Follow-up call with Alice',
  description: 'Confirm pricing structure',
  duration: { seconds: 900, nanos: 0 },
  outcome: 1, // PLANNED
};

export const discoveryMeetingFields = {
  type: 2, // MEETING
  subject: 'Discovery: Acme Q4 scoping',
  duration: { seconds: 1800, nanos: 0 },
  outcome: 1,
};

export const proposalEmailFields = {
  type: 4, // EMAIL
  subject: 'Proposal sent: Acme Q4',
  outcome: 2, // COMPLETED
  is_completed: true,
};

export const finalizeContractTaskFields = {
  type: 3, // TASK
  subject: 'Send final contract',
  outcome: 1,
};

/** Multi-link fixture: meeting attended by 2 contacts and ties to 1 deal. */
export const multiLinkedMeetingFields = {
  type: 2,
  subject: 'Three-way call: Alice + Bob + Acme deal',
  outcome: 1,
  // linked_entities filled at scenario time
};
