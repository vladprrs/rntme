import { describe, it, expect } from 'bun:test';
import { BindingArtifactSchema } from '../../../src/parse/schema.js';

const minimalArtifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
      exposure: 'read',
      graph: 'g',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'GET',
        path: '/v1/things',
        parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
      },
    },
  },
};

describe('BindingArtifactSchema', () => {
  it('accepts a minimal valid artifact', () => {
    expect(BindingArtifactSchema.safeParse(minimalArtifact).success).toBe(true);
  });

  it('rejects unknown top-level version', () => {
    const bad = { ...minimalArtifact, version: '2.0' };
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid method', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.method = 'DELETE';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid parameter location', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.parameters[0].in = 'header';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects path without leading slash', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.path = 'v1/things';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects path containing query string', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.path = '/v1/things?limit=5';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts passthrough openapi fragments', () => {
    const ok = JSON.parse(JSON.stringify(minimalArtifact));
    ok.bindings.primary.http.openapi = { 'x-rate-limit': { max: 60 } };
    ok.bindings.primary.http.parameters[0].openapi = { example: 5 };
    expect(BindingArtifactSchema.safeParse(ok).success).toBe(true);
  });

  it('accepts optional top-level openapi defaults', () => {
    const ok = {
      ...minimalArtifact,
      openapi: {
        info: { title: 'T', version: '0.0.1' },
        servers: [{ url: 'https://api.example.com' }],
      },
    };
    expect(BindingArtifactSchema.safeParse(ok).success).toBe(true);
  });

  it('rejects empty parameters name', () => {
    const bad = JSON.parse(JSON.stringify(minimalArtifact));
    bad.bindings.primary.http.parameters[0].name = '';
    expect(BindingArtifactSchema.safeParse(bad).success).toBe(false);
  });

  it('accepts json response status and headers', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0',
      graphSpecRef: 'g',
      pdmRef: 'p',
      qsmRef: 'q',
      bindings: {
        introspectToken: {
          exposure: 'read',
          graph: 'IntrospectToken',
          target: { engine: 'native', dialect: 'platform' },
          http: { method: 'GET', path: '/introspect', parameters: [] },
          response: {
            onOk: {
              json: null,
              headers: {
                'X-Rntme-User-Sub': '$result.subject.account.id',
                'X-Rntme-User-Audience': 'urn:rntme:platform-tokens',
                'X-Rntme-Session-Status': 'ACTIVE',
              },
            },
            onErr: {
              json: { code: '$error.code', message: '$error.message' },
              status: 401,
            },
          },
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('requires exposure and rejects legacy kind/pre', () => {
    const input = {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: {
        a: {
          exposure: 'read',
          graph: 'g',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: { method: 'GET', path: '/v1/things', parameters: [] },
        },
      },
    };
    const r = BindingArtifactSchema.safeParse(input);
    expect(r.success).toBe(true);

    const legacy = {
      version: '1.0',
      graphSpecRef: 'x',
      pdmRef: 'y',
      qsmRef: 'z',
      bindings: {
        bad: {
          kind: 'command',
          graph: 'g',
          target: { engine: 'sqlite', dialect: 'sqlite' },
          http: { method: 'POST', path: '/v1/cmd', parameters: [] },
          pre: [],
        },
      },
    };
    expect(BindingArtifactSchema.safeParse(legacy).success).toBe(false);
  });
});
