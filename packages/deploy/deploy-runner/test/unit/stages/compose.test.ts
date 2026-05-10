import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compose, StageError } from '../../../src/stages/compose.js';

function writeMinimalBlueprint(dir: string): void {
  // Minimum shape accepted by loadComposedBlueprint: project.json with at least
  // one declared service, a pdm/ dir with pdm.json + entities/, and a matching
  // services/<slug>/service.json. The compose stage today returns the
  // ComposedBlueprint as-is (the toDeployCoreInput lift comes in a later task),
  // so we assert against that shape here.
  mkdirSync(join(dir, 'pdm', 'entities'), { recursive: true });
  mkdirSync(join(dir, 'services', 'svc1'), { recursive: true });
  writeFileSync(
    join(dir, 'project.json'),
    JSON.stringify({ name: 'demo', services: ['svc1'] }),
  );
  writeFileSync(join(dir, 'pdm', 'pdm.json'), JSON.stringify({ version: '1' }));
  writeFileSync(join(dir, 'services', 'svc1', 'service.json'), JSON.stringify({ kind: 'domain' }));
}

describe('stages.compose', () => {
  it('loads a minimal materialized blueprint and returns the composed project', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'compose-test-'));
    writeMinimalBlueprint(dir);

    const result = await compose({ bundleDir: dir });

    // loadComposedBlueprint returns ComposedBlueprint, where the project name
    // lives at `composed.project.name`. The ComposeStageOutput type currently
    // casts this to ComposedProjectInput, but the runtime shape is the
    // ComposedBlueprint. Future task 5 wires in toDeployCoreInput so
    // composed.name will hold the string directly.
    const composedAsBlueprint = result.composed as unknown as { project: { name: string } };
    expect(composedAsBlueprint.project.name).toBe('demo');
    expect(result.bundleDir).toBe(dir);
  });

  it('throws DEPLOY_COMPOSE_FAILED when blueprint is invalid', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'compose-test-'));
    writeFileSync(join(dir, 'project.json'), '{ not valid json');

    await expect(compose({ bundleDir: dir })).rejects.toBeInstanceOf(StageError);
    await expect(compose({ bundleDir: dir })).rejects.toMatchObject({
      code: 'DEPLOY_COMPOSE_FAILED',
    });
  });
});
