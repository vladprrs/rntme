import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadTargetFile } from '../../../src/deploy-engine/load-target.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(here, '..', '..', 'fixtures', 'target-dokploy.json');

describe('loadTargetFile', () => {
  it('parses a valid dokploy target file into a normalized target', async () => {
    const result = await loadTargetFile(fixturePath, 'preview');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.target.slug).toBe('preview');
      expect(result.value.target.kind).toBe('dokploy');
      expect(result.value.target.dokployUrl).toBe('https://dokploy.example.com');
      expect(result.value.secretRefs.apiToken.source).toBe('env');
      expect(result.value.secretRefs.apiToken.name).toBe('DOKPLOY_API_TOKEN');
    }
  });

  it('returns CLI_DEPLOY_TARGET_FILE_INVALID for missing file', async () => {
    const result = await loadTargetFile('/no/such/file.json', 'x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_TARGET_FILE_INVALID');
  });

  it('rejects unknown kind', async () => {
    const result = await loadTargetFile(fixturePath, 'preview', {
      readFile: async () => JSON.stringify({ kind: 'mystery', displayName: 'x' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CLI_DEPLOY_TARGET_FILE_INVALID');
  });
});
