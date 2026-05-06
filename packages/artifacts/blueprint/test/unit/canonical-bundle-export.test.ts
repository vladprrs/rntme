import { describe, expect, it } from 'vitest';
import type { CanonicalBundle } from '@rntme/blueprint';

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
