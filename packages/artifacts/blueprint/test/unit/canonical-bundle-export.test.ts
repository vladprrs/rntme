import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'bun:test';
import type { CanonicalBundle } from '../../src/index.js';

describe('CanonicalBundle re-export', () => {
  it('is structurally compatible with version 2 bundles', () => {
    const bundle: CanonicalBundle = {
      version: 2,
      files: { 'project.json': { name: 'demo', services: [] } },
      assets: { 'workflows/demo.bpmn': Buffer.from('<xml/>').toString('base64') },
    };

    expect(bundle.version).toBe(2);
  });
});
