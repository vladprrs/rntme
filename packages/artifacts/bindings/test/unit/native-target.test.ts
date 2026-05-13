import { describe, it, expect } from 'bun:test';
import { BindingArtifactSchema } from '../../src/parse/schema.js';

const base = {
  version: '1.0',
  graphSpecRef: 'g',
  pdmRef: 'p',
  qsmRef: 'q',
};

describe('native target + bodyBytes input source', () => {
  it('accepts target.engine="native" with dialect="platform"', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        publishProjectBundle: {
          exposure: 'action',
          graph: 'publishProjectBundle',
          target: { engine: 'native', dialect: 'platform' },
          http: {
            method: 'POST',
            path: '/{projectId}/versions',
            parameters: [
              { name: 'projectId', in: 'path', bindTo: 'projectId', required: true },
            ],
          },
          inputFrom: {
            authorization: { from: 'header', name: 'authorization', required: true },
            bodyBytes: { from: 'bodyBytes' },
          },
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('accepts inputFrom.bodyBytes alongside other sources', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        publishProjectBundle: {
          exposure: 'action',
          graph: 'publishProjectBundle',
          target: { engine: 'native', dialect: 'platform' },
          http: { method: 'POST', path: '/versions', parameters: [] },
          inputFrom: {
            bodyBytes: { from: 'bodyBytes' },
          },
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects bodyBytes input source with extra properties', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: {
          exposure: 'action',
          graph: 'g',
          target: { engine: 'native', dialect: 'platform' },
          http: { method: 'POST', path: '/x', parameters: [] },
          inputFrom: {
            bodyBytes: { from: 'bodyBytes', name: 'extra' },
          },
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects target with empty engine string', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: {
          exposure: 'action',
          graph: 'g',
          target: { engine: '', dialect: 'platform' },
          http: { method: 'POST', path: '/x', parameters: [] },
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects target with empty dialect string', () => {
    const r = BindingArtifactSchema.safeParse({
      ...base,
      bindings: {
        bad: {
          exposure: 'action',
          graph: 'g',
          target: { engine: 'native', dialect: '' },
          http: { method: 'POST', path: '/x', parameters: [] },
        },
      },
    });
    expect(r.success).toBe(false);
  });
});
