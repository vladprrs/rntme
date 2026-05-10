import { describe, expect, it } from 'bun:test';
import { redact } from '@rntme/deploy-runner';

describe('redact', () => {
  it('redacts common JSON secret fields while preserving key names', () => {
    const input = JSON.stringify({
      apiToken: 'tok_live_123',
      client_secret: 'client-secret-value',
      access_token: 'access-token-value',
      message: 'normal text with token mention',
    });

    expect(redact(input)).toBe(
      '{"apiToken":"***","client_secret":"***","access_token":"***","message":"normal text with token mention"}',
    );
  });

  it('redacts header-like authorization and api key values', () => {
    expect(redact('Authorization: Bearer abc.def-123\nx-api-key: key-123')).toBe(
      'Authorization: Bearer ***\nx-api-key: ***',
    );
    expect(redact('Authorization: Basic dXNlcjpwYXNz')).toBe('Authorization: Basic ***');
  });

  it('redacts URL query parameter secret values', () => {
    expect(redact('GET /callback?token=abc123&api_key=k456&client_secret=s789&name=demo')).toBe(
      'GET /callback?token=***&api_key=***&client_secret=***&name=demo',
    );
  });

  it('preserves existing password assignment redaction', () => {
    expect(redact('password=hunter2 next=visible')).toBe('password=*** next=visible');
  });
});

describe('redact — provisioner extensions', () => {
  it('redacts mgmt_client_secret in JSON-shaped strings', () => {
    expect(redact('{"mgmt_client_secret":"abc123"}')).not.toContain('abc123');
  });

  it('redacts mgmtClientSecret camelCase', () => {
    expect(redact('{"mgmtClientSecret":"abc123"}')).not.toContain('abc123');
  });

  it('redacts m2mClients[*].clientSecret embedded values', () => {
    const out = redact('m2mClients=[{"clientSecret":"shh"}]');
    expect(out).not.toContain('shh');
  });

  it('redacts targetSecrets envelope payload values', () => {
    const out = redact('"targetSecrets":{"auth0Mgmt":{"mgmtClientSecret":"v"}}');
    expect(out).not.toContain('"v"');
  });
});

describe('redact — Operaton UI secrets', () => {
  it('redacts htpasswd hash fragments', () => {
    expect(redact('htpasswd admin:$apr1$xxxxx')).toBe('htpasswd ***');
    expect(redact('htpasswd: user:$2y$10$hash')).toBe('htpasswd: ***');
    expect(redact('some htpasswd content here')).toBe('some htpasswd *** here');
  });

  it('redacts adminUser values', () => {
    expect(redact('adminUser=superadmin')).toBe('adminUser=***');
    expect(redact('"adminUser":"root"')).toBe('"adminUser":"***"');
  });

  it('redacts admin-user values', () => {
    expect(redact('admin-user=root')).toBe('admin-user=***');
    expect(redact('"admin-user":"admin"')).toBe('"admin-user":"***"');
  });

  it('redacts operatonAdmin values', () => {
    expect(redact('operatonAdmin=demo')).toBe('operatonAdmin=***');
    expect(redact('"operatonAdmin":"admin"')).toBe('"operatonAdmin":"***"');
  });

  it('redacts applicationYaml values', () => {
    expect(redact('applicationYaml=secret')).toBe('applicationYaml=***');
    expect(redact('"applicationYaml":"config"')).toBe('"applicationYaml":"***"');
  });

  it('does not redact non-secret URLs', () => {
    expect(redact('https://example.com/path?token=abc')).toBe('https://example.com/path?token=***');
    expect(redact('visit https://example.com for docs')).toBe('visit https://example.com for docs');
  });
});
