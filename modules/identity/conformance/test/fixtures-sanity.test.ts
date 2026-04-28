import { describe, expect, it } from 'vitest';
import { proto } from '@rntme/contracts-identity-v1';
import packageJson from '../package.json' with { type: 'json' };
import {
  fixtureInvitations,
  fixtureOrganizations,
  fixtureSessions,
  fixtureUsers,
} from '../src/fixtures/index.js';
import { CONFORMANCE_IDENTITY_MODULE_VERSION } from '../src/fixtures/ref.js';

const id = proto.rntme.contracts.identity.v1;

function expectCanonicalRef(ref: {
  canonical_id?: string | null;
  vendor_id?: string | null;
  module_name?: string | null;
  module_version?: string | null;
  contract_version?: string | null;
}) {
  expect(ref.canonical_id).toBeTruthy();
  expect(ref.vendor_id).toBeTruthy();
  expect(ref.module_name).toBe('identity-fixture');
  expect(ref.module_version).toBe(CONFORMANCE_IDENTITY_MODULE_VERSION);
  expect(ref.contract_version).toBe('v1');
}

describe('identity fixtures', () => {
  it('keeps fixture module_version aligned with package.json version', () => {
    expect(CONFORMANCE_IDENTITY_MODULE_VERSION).toBe(packageJson.version);
  });

  it('validates every User fixture with protobuf verify()', () => {
    for (const user of Object.values(fixtureUsers)) {
      expect(id.User.verify(user)).toBeNull();
      expectCanonicalRef(user.ref!);
    }
  });

  it('validates every Organization fixture with protobuf verify()', () => {
    for (const organization of Object.values(fixtureOrganizations)) {
      expect(id.Organization.verify(organization)).toBeNull();
      expectCanonicalRef(organization.ref!);
    }
  });

  it('validates every Invitation fixture with protobuf verify()', () => {
    for (const invitation of Object.values(fixtureInvitations)) {
      expect(id.Invitation.verify(invitation)).toBeNull();
      expectCanonicalRef(invitation.ref!);
    }
  });

  it('validates every Session fixture with protobuf verify()', () => {
    for (const session of Object.values(fixtureSessions)) {
      expect(id.Session.verify(session)).toBeNull();
      expectCanonicalRef(session.ref!);
    }
  });
});
