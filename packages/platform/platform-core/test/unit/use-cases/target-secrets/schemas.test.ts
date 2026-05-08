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

  it('registers redpanda-console-basic-auth-v1', () => {
    expect(TARGET_SECRET_SCHEMAS).toHaveProperty('redpanda-console-basic-auth-v1');
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

  it('parseTargetSecret accepts a Redpanda Console htpasswd line for the declared username', () => {
    const r = parseTargetSecret('redpanda-console-basic-auth-v1', {
      username: 'operator',
      htpasswdB64: Buffer.from('operator:$apr1$rounds$salthash\n', 'utf8').toString('base64'),
    });
    expect(r.ok).toBe(true);
  });

  it('parseTargetSecret rejects non-canonical Redpanda Console htpasswd base64', () => {
    const valid = Buffer.from('operator:$apr1$rounds$salthash', 'utf8').toString('base64');
    const r = parseTargetSecret('redpanda-console-basic-auth-v1', {
      username: 'operator',
      htpasswdB64: `${valid}$`,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((error) => error.message)).toContain('htpasswdB64 must be valid base64');
    }
  });

  it('parseTargetSecret rejects Redpanda Console username mismatch', () => {
    const r = parseTargetSecret('redpanda-console-basic-auth-v1', {
      username: 'operator',
      htpasswdB64: Buffer.from('other:$apr1$rounds$salthash', 'utf8').toString('base64'),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.map((error) => error.message)).toContain(
        'htpasswdB64 must decode to a single htpasswd line for username',
      );
    }
  });
});
