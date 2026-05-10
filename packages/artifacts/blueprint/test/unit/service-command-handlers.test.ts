import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';
import { loadComposedBlueprint } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const notesDemoDir = join(here, '..', '..', '..', '..', '..', 'demo', 'notes-blueprint');

describe('domain service command handler files', () => {
  it('rejects executable command handlers in domain service blueprints', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-blueprint-handlers-'));
    cpSync(notesDemoDir, dir, { recursive: true });
    mkdirSync(join(dir, 'services', 'app', 'commands'), { recursive: true });
    writeFileSync(join(dir, 'services', 'app', 'commands', 'handlers.mjs'), 'export default {};\n');

    const result = await loadComposedBlueprint(dir);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_DOMAIN_COMMAND_HANDLER_FORBIDDEN')).toBe(true);
    }
  });
});
