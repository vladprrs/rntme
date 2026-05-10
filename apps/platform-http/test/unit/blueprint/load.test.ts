import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';
import type { CanonicalBundle } from '@rntme/platform-core';

import { materializeAndCompose } from '../../../src/blueprint/load.js';

describe('materializeAndCompose', () => {
  it('writes bundle assets before composing workflow BPMN references', async () => {
    const result = await materializeAndCompose(orderFulfillmentBundle());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.composed.workflows?.definitions).toEqual([
      expect.objectContaining({
        id: 'orderFulfillment',
        bpmnFile: 'order-fulfillment.bpmn',
        processId: 'orderFulfillment',
      }),
    ]);
  });

  it('serializes blueprint errors into PlatformError.errors[]', async () => {
    const result = await materializeAndCompose({
      version: 2,
      files: { 'project.json': { name: 'demo', services: ['missing'] } },
      assets: {},
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
      stage: 'validation',
      errors: [
        expect.objectContaining({
          code: 'BLUEPRINT_IO_ERROR',
          path: 'pdm',
        }),
      ],
    });
  });
});

function orderFulfillmentBundle(): CanonicalBundle {
  const root = join(repoRoot(), 'demo', 'order-fulfillment-blueprint');
  const files: Record<string, unknown> = {};
  const assets: Record<string, string> = {};

  for (const relPath of walk(root)) {
    const absPath = join(root, relPath);
    if (relPath.endsWith('.json')) {
      files[relPath] = JSON.parse(readFileSync(absPath, 'utf8'));
    }
    if (relPath.endsWith('.bpmn')) {
      assets[relPath] = readFileSync(absPath).toString('base64');
    }
  }

  return { version: 2, files, assets };
}

function walk(root: string): string[] {
  const out: string[] = [];
  function visit(dir: string): void {
    for (const name of readdirSync(dir).sort()) {
      const absPath = join(dir, name);
      const st = statSync(absPath);
      if (st.isDirectory()) {
        visit(absPath);
        continue;
      }
      if (st.isFile()) out.push(relative(root, absPath).split(sep).join('/'));
    }
  }
  visit(root);
  return out.sort();
}

function repoRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
}
