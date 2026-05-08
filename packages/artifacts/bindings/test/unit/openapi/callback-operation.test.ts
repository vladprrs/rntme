import { describe, it, expect } from 'vitest';
import { generateOpenApi } from '../../../src/openapi/emit.js';
import type { ValidatedBindings, BindingEntry } from '../../../src/types/artifact.js';
import type { GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';

const emptyEffects = {
  localReads: false,
  localEmits: [],
  calls: [],
  waits: false,
} as const;

function makeValidated(bindingId: string, entry: Record<string, unknown>, outputShapeName = 'CallbackResult') {
  const outputShape: ResolvedShape = {
    name: outputShapeName,
    origin: 'custom',
    fields: {
      aggregateId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
      version: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
      eventIds: { type: { kind: 'array', element: 'string' }, nullable: false },
    },
  };
  return {
    artifact: { version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q' } as const,
    resolved: {
      [bindingId]: {
        entry: entry as BindingEntry,
        signature: {
          id: entry.graph as string,
          inputs: {},
          output: { type: { kind: 'row', shape: outputShapeName }, from: 'result' },
          effects: emptyEffects,
        } as GraphSignature,
        outputShape,
      },
    },
  } as unknown as ValidatedBindings;
}

describe('OpenAPI emission for P2 callback', () => {
  it('emits a GET operation with 302 response for redirect callback', () => {
    const doc = generateOpenApi(makeValidated('stripeCallback', {
      exposure: 'action',
      graph: 'callbackAck',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/oauth/stripe/callback', parameters: [] },
      inputFrom: {
        state: { from: 'query', name: 'state', required: true },
        code: { from: 'query', name: 'code', required: true },
      },
      response: {
        onOk: { redirect: '/app/connected?flow={$result.aggregateId}', status: 302 },
        onErr: { redirect: '/app/error?c={$error.code}' },
      },
    }));
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const op = doc.value.paths['/oauth/stripe/callback']?.get;
    expect(op).toBeDefined();
    expect(op!.requestBody).toBeUndefined();
    expect(op!.responses['302']).toBeDefined();
    expect(op!.responses['302']!.headers).toBeDefined();
    expect(op!.responses['302']!.headers!.Location).toBeDefined();
    expect(op!.parameters).toBeDefined();
    expect(op!.parameters!.length).toBe(2);
  });

  it('emits 303 response when status is 303', () => {
    const doc = generateOpenApi(makeValidated('callback', {
      exposure: 'action',
      graph: 'callbackAck',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/callback', parameters: [] },
      response: {
        onOk: { redirect: '/app', status: 303 },
        onErr: { json: '$error' },
      },
    }));
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const op = doc.value.paths['/callback']?.get;
    expect(op).toBeDefined();
    expect(op!.responses['303']).toBeDefined();
  });

  it('defaults redirect status to 302 when omitted', () => {
    const doc = generateOpenApi(makeValidated('callback', {
      exposure: 'action',
      graph: 'callbackAck',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'GET', path: '/callback', parameters: [] },
      response: {
        onOk: { redirect: '/app' },
        onErr: { json: '$error' },
      },
    }));
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const op = doc.value.paths['/callback']?.get;
    expect(op).toBeDefined();
    expect(op!.responses['302']).toBeDefined();
  });

  it('keeps existing 200 JSON behavior for bindings without explicit response', () => {
    const doc = generateOpenApi(makeValidated('createOrder', {
      exposure: 'action',
      graph: 'createOrder',
      target: { engine: 'graph-ir', dialect: 'sqlite' },
      http: { method: 'POST', path: '/commands/createOrder', parameters: [] },
    }));
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    const op = doc.value.paths['/commands/createOrder']?.post;
    expect(op).toBeDefined();
    expect(op!.responses['200']).toBeDefined();
    expect(op!.responses['302']).toBeUndefined();
  });
});
