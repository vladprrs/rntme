import { describe, expect, it } from 'bun:test';
import { safeProvisionerName } from '../../src/compose/safe-provisioner-name.js';

describe('safeProvisionerName', () => {
  it('drops a leading @ and replaces / with __', () => {
    expect(safeProvisionerName('@rntme/identity-auth0')).toBe('rntme__identity-auth0');
  });

  it('handles unscoped names unchanged', () => {
    expect(safeProvisionerName('rntme_identity_auth0')).toBe('rntme_identity_auth0');
  });

  it('replaces every / segment, not just the first', () => {
    expect(safeProvisionerName('@a/b/c')).toBe('a__b__c');
  });

  it('throws on empty input', () => {
    expect(() => safeProvisionerName('')).toThrow(/manifest name is empty/);
  });
});
