import { describe, expect, it } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toDeployCoreInput } from '../../../src/deploy-engine/to-deploy-core-input.js';

function makeMinimalComposed(): {
  readonly name: string;
  readonly project: { name: string; services: string[] };
  readonly services: Record<string, never>;
  readonly publicConfigJson: null;
  readonly varsManifest: Record<string, never>;
} {
  return {
    name: 'demo',
    project: { name: 'demo', services: [] },
    services: {},
    publicConfigJson: null,
    varsManifest: {},
  };
}

describe('toDeployCoreInput', () => {
  it('passes through ComposedProjectInput shape unchanged when input already matches', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'cli-deploy-engine-'));
    const input = makeMinimalComposed();
    const result = await toDeployCoreInput(input as never, dir);
    expect(result.name).toBe('demo');
    expect(result.services).toEqual({});
  });
});
