import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../src/compose/load-composed-blueprint.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'product-catalog-project');

describe('loadComposedBlueprint', () => {
  it('compiles app ui against project-routed foreign bindings', () => {
    const r = loadComposedBlueprint(fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.bindingRegistry['pricing.listPrices']?.path).toBe('/api/pricing/prices');
    expect(r.value.services.app?.compiledUi?.screens.home?.data?.['/data/prices']?.path).toBe('/api/pricing/prices');
    expect(r.value.services.app?.qsmValidated).not.toBeNull();
    expect(r.value.services.pricing?.seed).not.toBeNull();
  });

  it('fails when app ui references a service that is not published through project.routes.http', () => {
    const temp = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const copied = join(temp, 'product-catalog-project');
    cpSync(fixtureDir, copied, { recursive: true });

    const projectPath = join(copied, 'project.json');
    const raw = JSON.parse(readFileSync(projectPath, 'utf8'));
    delete raw.routes.http['/api/pricing'];
    writeFileSync(projectPath, JSON.stringify(raw, null, 2));

    const r = loadComposedBlueprint(copied);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BLUEPRINT_SERVICE_UI_INVALID')).toBe(true);
    }
  });
});
