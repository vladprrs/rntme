import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../src/validate/structural.js';
import { err, ok, ERROR_CODES } from '../../src/types/result.js';

function makeArtifact(bindingId: string, entry: Record<string, unknown>) {
  return {
    version: '1.0' as const,
    graphSpecRef: 'g',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: { [bindingId]: entry },
  };
}

describe('P2 callback structural validation', () => {
  it('accepts GET command binding when response.onOk is a redirect', () => {
    const artifact = makeArtifact('cb', {
      kind: 'command',
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

  it('rejects GET command binding without response.redirect', () => {
    const artifact = makeArtifact('cb', {
      kind: 'command',
      graph: 'completeOAuth',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/callback', parameters: [] },
    });
    const result = validateStructural(artifact);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].code).toBe(ERROR_CODES.BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT);
    }
  });

  it('rejects duplicate graph-input mappings across inputFrom and parameters[]', () => {
    const artifact = makeArtifact('cb', {
      kind: 'command',
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
      expect(result.errors[0].code).toBe(ERROR_CODES.BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE);
    }
  });

  it('rejects body inputFrom on GET', () => {
    const artifact = makeArtifact('cb', {
      kind: 'command',
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
      expect(result.errors[0].code).toBe(ERROR_CODES.BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY);
    }
  });

  it('rejects form inputFrom on GET', () => {
    const artifact = makeArtifact('cb', {
      kind: 'command',
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
      expect(result.errors[0].code).toBe(ERROR_CODES.BINDINGS_STRUCTURAL_RESPONSE_REDIRECT_ON_QUERY);
    }
  });
});
