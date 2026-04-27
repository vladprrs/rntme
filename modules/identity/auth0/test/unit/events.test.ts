import { describe, expect, it } from 'vitest';
import { CLAIMED_EVENTS } from '../../src/capabilities.js';
import { translateAuth0LogEvent } from '../../src/events.js';

describe('Auth0 log event translation', () => {
  it('translates claimed user and organization lifecycle events when payloads are present', () => {
    expect(
      translateAuth0LogEvent({
        type: 'ss',
        user_id: 'auth0|u1',
        user_name: 'ada@example.com',
        date: '2026-01-02T03:04:05.000Z',
      }),
    ).toMatchObject({
      type: 'UserCreated',
      payload: { user: { ref: { canonical_id: 'auth0|u1' }, email: 'ada@example.com' } },
    });

    expect(
      translateAuth0LogEvent({
        type: 'organization_created',
        organization_id: 'org_123',
        organization_name: 'acme',
      }),
    ).toMatchObject({
      type: 'OrganizationCreated',
      payload: { organization: { ref: { canonical_id: 'org_123' } } },
    });
  });

  it('returns null for unsupported or underspecified Auth0 log records', () => {
    expect(translateAuth0LogEvent({ type: 'sapi' })).toBeNull();
    expect(translateAuth0LogEvent({ type: 'organization.created' })).toBeNull();
  });

  it('has a sample translator for every claimed event', () => {
    const samples = [
      { type: 'ss', user_id: 'auth0|u1', user_name: 'ada@example.com' },
      { type: 'du', user_id: 'auth0|u1' },
      { type: 'sv', user_id: 'auth0|u1', user_name: 'ada@example.com' },
      { type: 'organization_created', organization_id: 'org_123', organization_name: 'acme' },
      { type: 'organization_member_added', organization_id: 'org_123', user_id: 'auth0|u1' },
      { type: 'organization_member_deleted', organization_id: 'org_123', user_id: 'auth0|u1' },
      { type: 'organization_invitation_created', organization_id: 'org_123', invitation_id: 'inv_123' },
      { type: 'organization_invitation_accepted', organization_id: 'org_123', invitation_id: 'inv_123' },
      { type: 'organization_invitation_revoked', organization_id: 'org_123', invitation_id: 'inv_123' },
    ];
    const translated = samples.map((sample) => translateAuth0LogEvent(sample)?.type ?? null);
    expect(translated).not.toContain(null);
    expect([...translated].sort()).toEqual([...CLAIMED_EVENTS].sort());
  });

  it('uses explicit user deletion hardness when present', () => {
    expect(
      translateAuth0LogEvent({
        type: 'du',
        user_id: 'auth0|u1',
        hard_delete: false,
      }),
    ).toMatchObject({
      type: 'UserDeleted',
      payload: { hard_delete: false },
    });
  });
});
