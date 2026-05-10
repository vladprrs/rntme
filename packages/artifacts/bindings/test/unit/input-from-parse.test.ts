import { describe, it, expect } from 'bun:test';
import { BindingArtifactSchema } from '../../src/parse/schema.js';

const base = {
  version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
};

const baseCallback = {
  exposure: 'action',
  graph: 'completeOAuth',
  target: { engine: 'graph-ir', dialect: 'sqlite' },
  http: { method: 'GET', path: '/oauth/stripe/callback', parameters: [] },
};

describe('inputFrom + response parsing', () => {
  it('accepts inputFrom.query + redirect response', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        completeOAuth: {
          ...baseCallback,
          inputFrom: {
            state: { from: 'query', name: 'state', required: true },
            code:  { from: 'query', name: 'code',  required: true },
          },
          response: {
            onOk:  { redirect: '/settings?connected=1', status: 302 },
            onErr: { redirect: '/errors/{$errorCode}' },
          },
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('accepts inputFrom.header and inputFrom.form', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        samlAcs: {
          exposure: 'action',
          graph: 'handleSaml',
          target: { engine: 'graph-ir', dialect: 'sqlite' },
          http: { method: 'POST', path: '/saml/acs', parameters: [] },
          inputFrom: {
            relayState: { from: 'form', name: 'RelayState' },
            samlResponse: { from: 'form', name: 'SAMLResponse', required: true },
            ua: { from: 'header', name: 'User-Agent' },
          },
          response: { onOk: { json: '$result' }, onErr: { json: '$error' } },
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown from: kind', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: { ...baseCallback, inputFrom: { x: { from: 'cookie', name: 'c' } } },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects response branch missing both json and redirect', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: { ...baseCallback, response: { onOk: {}, onErr: { json: '$error' } } },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects response.redirect with invalid status', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: { ...baseCallback, response: { onOk: { redirect: '/x', status: 301 }, onErr: { json: '$error' } } },
      },
    });
    expect(r.success).toBe(false);
  });
});
