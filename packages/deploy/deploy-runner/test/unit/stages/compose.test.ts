import { describe, expect, it } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compose, StageError } from '../../../src/stages/compose.js';

function writeMinimalBlueprint(dir: string): void {
  // Minimum shape accepted by loadComposedBlueprint AND the toDeployCoreInput
  // lift: a project.json with one declared service of kind="integration" so
  // the lift skips buildRuntimeArtifactFiles (which would require graphs +
  // bindings + qsm directories per service).
  mkdirSync(join(dir, 'pdm', 'entities'), { recursive: true });
  mkdirSync(join(dir, 'services', 'mod-svc1'), { recursive: true });
  writeFileSync(
    join(dir, 'project.json'),
    JSON.stringify({ name: 'demo', services: ['mod-svc1'] }),
  );
  writeFileSync(join(dir, 'pdm', 'pdm.json'), JSON.stringify({ version: '1' }));
  writeFileSync(join(dir, 'services', 'mod-svc1', 'service.json'), JSON.stringify({ kind: 'integration' }));
}

describe('stages.compose', () => {
  it('loads a minimal materialized blueprint and returns ComposedProjectInput', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'compose-test-'));
    writeMinimalBlueprint(dir);

    const result = await compose({ bundleDir: dir });

    expect(result.composed.name).toBe('demo');
    expect(result.composed.services).toBeDefined();
    expect(result.composed.services['mod-svc1']?.slug).toBe('mod-svc1');
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
