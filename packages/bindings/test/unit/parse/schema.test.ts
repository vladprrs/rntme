import { describe, it, expect } from 'vitest';
import { BindingArtifactSchema } from '../../../src/parse/schema.js';

const minimalArtifact = {
  version: '1.0',
  graphSpecRef: 'x',
  pdmRef: 'y',
  qsmRef: 'z',
  bindings: {
    primary: {
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
});
