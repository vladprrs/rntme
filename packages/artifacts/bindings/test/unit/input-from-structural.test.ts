import { describe, it, expect } from 'bun:test';
import { validateStructural } from '../../src/validate/structural.js';
import { ERROR_CODES } from '../../src/types/result.js';
import type { BindingArtifact } from '../../src/types/artifact.js';

function makeArtifact(bindingId: string, entry: Record<string, unknown>) {
  return {
    version: '1.0' as const,
    graphSpecRef: 'g',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: { [bindingId]: entry },
  } as unknown as BindingArtifact;
}

describe('P2 callback structural validation', () => {
  it('accepts GET action binding when response.onOk is a redirect', () => {
    const artifact = makeArtifact('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/callback', parameters: [] },
      response: {
        onOk: { redirect: '/app?ok=1' },
        onErr: { json: '$error' },
      },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(true);
  });

  it('rejects GET action binding without response.redirect', () => {
    const artifact = makeArtifact('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/callback', parameters: [] },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(ERROR_CODES.BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT);
    }
  });

  it('rejects duplicate graph-input mappings across inputFrom and parameters[]', () => {
    const artifact = makeArtifact('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: {
        method: 'POST',
        path: '/oauth/callback',
        parameters: [{ name: 'state', in: 'body', bindTo: 'state', required: true }],
      },
      inputFrom: {
        state: { from: 'query', name: 'state', required: true },
      },
      response: {
        onOk: { redirect: '/app?ok=1' },
        onErr: { json: '$error' },
      },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(ERROR_CODES.BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE);
    }
  });

  it('rejects body inputFrom on GET', () => {
    const artifact = makeArtifact('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/callback', parameters: [] },
      inputFrom: {
        payload: { from: 'body', path: 'data' },
      },
      response: {
        onOk: { redirect: '/app?ok=1' },
        onErr: { json: '$error' },
      },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(ERROR_CODES.BINDINGS_STRUCTURAL_INPUT_FROM_BODY_ON_GET);
    }
  });

  it('rejects form inputFrom on GET', () => {
    const artifact = makeArtifact('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/callback', parameters: [] },
      inputFrom: {
        token: { from: 'form', name: 'token' },
      },
      response: {
        onOk: { redirect: '/app?ok=1' },
        onErr: { json: '$error' },
      },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(ERROR_CODES.BINDINGS_STRUCTURAL_INPUT_FROM_BODY_ON_GET);
    }
  });

  it('rejects absolute redirect template without allowedRedirectHosts', () => {
    const artifact = makeArtifact('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/callback', parameters: [] },
      response: {
        onOk: { redirect: 'https://evil.example.com/steal?t={$result.token}' },
        onErr: { json: '$error' },
      },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === ERROR_CODES.BINDINGS_STRUCTURAL_REDIRECT_ABSOLUTE_HOST_NOT_ALLOWED)).toBe(true);
    }
  });

  it('accepts absolute redirect when origin is allowed', () => {
    const artifact = makeArtifact('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/callback', parameters: [] },
      allowedRedirectHosts: ['https://good.example.com'],
      response: {
        onOk: { redirect: 'https://good.example.com/flow?t={$result.token}' },
        onErr: { json: '$error' },
      },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(true);
  });

  it('rejects string redirect containing bare reference outside template braces', () => {
    const artifact = makeArtifact('cb', {
      exposure: 'action',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/callback', parameters: [] },
      response: {
        onOk: { redirect: '$result.redirectUrl' },
        onErr: { json: '$error' },
      },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === ERROR_CODES.BINDINGS_STRUCTURAL_REDIRECT_STRING_CONTAINS_BARE_REFERENCE)).toBe(true);
    }
  });
});
