import { describe, expect, it } from 'bun:test';
import * as entry from '../src/index.js';

const commonPrimitiveExports = [
  'CanonicalRef',
  'CommandContext',
  'Name',
  'ListRequest',
  'Filter',
  'Sort',
  'ListResponseMeta',
  'Metadata',
  'FilterOperator',
  'SortDirection',
] as const;

describe('package entry exports', () => {
  it('exports identity-owned runtime primitives from src/index.ts', () => {
    expect(entry.User).toBe(entry.proto.rntme.contracts.identity.v1.User);
    expect(entry.Organization).toBe(entry.proto.rntme.contracts.identity.v1.Organization);
    expect(entry.OrganizationMembership).toBe(entry.proto.rntme.contracts.identity.v1.OrganizationMembership);
    expect(entry.Invitation).toBe(entry.proto.rntme.contracts.identity.v1.Invitation);
    expect(entry.Session).toBe(entry.proto.rntme.contracts.identity.v1.Session);
    expect(entry.IdentityResolution).toBe(entry.proto.rntme.contracts.identity.v1.IdentityResolution);
    expect(entry.IdentityModule).toBe(entry.proto.rntme.contracts.identity.v1.IdentityModule);
  });

  it('keeps common-v1 primitives behind the proto namespace boundary', () => {
    for (const exportName of commonPrimitiveExports) {
      expect(entry).not.toHaveProperty(exportName);
    }
    expect(entry.proto.rntme.contracts.common.v1.CanonicalRef).toBeDefined();
  });
});
