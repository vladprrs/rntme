import { describe, expect, it } from 'vitest';
import {
  TARGET_SECRET_SCHEMAS,
  parseTargetSecret,
  type TargetSecretSchemaId,
} from '../../../../src/use-cases/target-secrets/schemas.js';

describe('TARGET_SECRET_SCHEMAS', () => {
  it('registers auth0-mgmt-api-v1', () => {
    expect(TARGET_SECRET_SCHEMAS).toHaveProperty('auth0-mgmt-api-v1');
  });

  it('parseTargetSecret returns Ok for valid auth0Mgmt payload', () => {
    const r = parseTargetSecret('auth0-mgmt-api-v1', {
      tenantDomain: 'demo.us.auth0.com',
      mgmtClientId: 'abc',
      mgmtClientSecret: 'xyz',
    });
    expect(r.ok).toBe(true);
  });

  it('parseTargetSecret returns Err for missing mgmtClientSecret', () => {
    const r = parseTargetSecret('auth0-mgmt-api-v1', {
      tenantDomain: 'demo.us.auth0.com',
      mgmtClientId: 'abc',
    });
    expect(r.ok).toBe(false);
  });

  it('parseTargetSecret returns Err for unknown schema id', () => {
    const r = parseTargetSecret('not-a-schema' as TargetSecretSchemaId, {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe('TARGET_SECRET_SCHEMA_UNKNOWN');
    }
  });
});
