import { describe, it, expect } from 'vitest';
import { inactiveIntrospectSession, introspectSessionInactiveReason } from '../../src/pre/auth-session.js';

describe('inactiveIntrospectSession', () => {
  it('is false for other rpc names', () => {
    expect(inactiveIntrospectSession('GetSession', { status: 2 })).toBe(false);
  });

  it('is false for ACTIVE numeric or string enum', () => {
    expect(inactiveIntrospectSession('IntrospectSession', { status: 1 })).toBe(false);
    expect(inactiveIntrospectSession('IntrospectSession', { status: 'SESSION_STATUS_ACTIVE' })).toBe(false);
  });

  it('is true for non-ACTIVE Session', () => {
    expect(inactiveIntrospectSession('IntrospectSession', { status: 0 })).toBe(true);
    expect(inactiveIntrospectSession('IntrospectSession', { status: 2 })).toBe(true);
    expect(inactiveIntrospectSession('IntrospectSession', { status: 'SESSION_STATUS_REVOKED' })).toBe(true);
  });

  it('returns vendor deactivation reason for non-ACTIVE Session', () => {
    expect(
      introspectSessionInactiveReason('IntrospectSession', {
        status: 'SESSION_STATUS_EXPIRED',
        vendor_raw: { deactivation_reason: 'TOKEN_EXPIRED' },
      }),
    ).toBe('TOKEN_EXPIRED');
    expect(introspectSessionInactiveReason('IntrospectSession', { status: 0 })).toBe('UNKNOWN');
    expect(introspectSessionInactiveReason('GetSession', { status: 0 })).toBeNull();
  });

  it('is true for malformed value', () => {
    expect(inactiveIntrospectSession('IntrospectSession', null)).toBe(true);
    expect(inactiveIntrospectSession('IntrospectSession', [])).toBe(true);
  });
});
