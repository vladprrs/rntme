import { describe, expect, it, spyOn } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadComposedBlueprint } from '../../src/compose/load-composed-blueprint.js';
import * as compositionModule from '../../src/validate/composition.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures', 'product-catalog-project');

function copyFixture(): string {
  const temp = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
  const copied = join(temp, 'product-catalog-project');
  cpSync(fixtureDir, copied, { recursive: true });
  return copied;
}

describe('loadComposedBlueprint', () => {
  it('compiles app ui against project-routed foreign bindings', async () => {
    const r = await loadComposedBlueprint(fixtureDir);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.value.bindingRegistry['pricing.listPrices']?.path).toBe('/api/pricing/prices');
    expect(r.value.services.app?.compiledUi?.screens.home?.data?.['/data/prices']?.path).toBe('/api/pricing/prices');
    expect(r.value.services.app?.qsmValidated).not.toBeNull();
    expect(r.value.services.pricing?.seed).not.toBeNull();
  });

  it('invokes validateBlueprintComposition exactly once per load', async () => {
    const spy = spyOn(compositionModule, 'validateBlueprintComposition');
    try {
      const r = await loadComposedBlueprint(fixtureDir);
      expect(r.ok).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('fails when app ui references a service that is not published through project.routes.http', async () => {
    const copied = copyFixture();

    const projectPath = join(copied, 'project.json');
    const raw = JSON.parse(readFileSync(projectPath, 'utf8'));
    delete raw.routes.http['/api/pricing'];
    writeFileSync(projectPath, JSON.stringify(raw, null, 2));

    const r = await loadComposedBlueprint(copied);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'BLUEPRINT_SERVICE_UI_INVALID')).toBe(true);
    }
  });

  it('fails when app ui navigates to an unknown route', async () => {
    const copied = copyFixture();
    const screenPath = join(copied, 'services', 'app', 'ui', 'screens', 'home.screen.json');
    const raw = JSON.parse(readFileSync(screenPath, 'utf8'));
    raw.actions = {
      goMissing: { kind: 'navigation', navigateTo: '/missing' },
    };
    writeFileSync(screenPath, JSON.stringify(raw, null, 2));

    const r = await loadComposedBlueprint(copied);
    expect(r.ok).toBe(false);
    if (r.ok) return;

    const uiError = r.errors.find((e) => e.code === 'BLUEPRINT_SERVICE_UI_INVALID');
    expect(uiError).toBeDefined();
    expect(uiError?.cause).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_ROUTE' })]),
    );
  });

  it('fails when app ui references an unknown component type', async () => {
    const copied = copyFixture();
    const specPath = join(copied, 'services', 'app', 'ui', 'screens', 'home.spec.json');
    const raw = JSON.parse(readFileSync(specPath, 'utf8'));
    raw.elements.unknown = { type: 'NotInCatalog', props: {} };
    raw.elements.page.children = [...raw.elements.page.children, 'unknown'];
    writeFileSync(specPath, JSON.stringify(raw, null, 2));

    const r = await loadComposedBlueprint(copied);
    expect(r.ok).toBe(false);
    if (r.ok) return;

    const uiError = r.errors.find((e) => e.code === 'BLUEPRINT_SERVICE_UI_INVALID');
    expect(uiError).toBeDefined();
    expect(uiError?.cause).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_COMPONENT_TYPE' })]),
    );
  });

  it('compiles module-qualified UI preset refs through project module keys', async () => {
    const copied = copyFixture();
    const projectPath = join(copied, 'project.json');
    const project = JSON.parse(readFileSync(projectPath, 'utf8'));
    project.modules = {
      ...(project.modules ?? {}),
      platformUi: { package: '@rntme/platform-ui' },
    };
    writeFileSync(projectPath, JSON.stringify(project, null, 2));

    mkdirSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'fragments'), { recursive: true });
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'package.json'), JSON.stringify({
      name: '@rntme/platform-ui',
      exports: { './module.json': './module.json' },
    }));
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'module.json'), JSON.stringify({
      name: '@rntme/platform-ui',
      version: '0.0.0',
      client: {
        presets: [
          { name: 'service-card', kind: 'fragment', path: 'fragments/service-card', inputs: { name: { type: 'string', required: true } } },
        ],
      },
    }));
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'fragments', 'service-card.spec.json'), JSON.stringify({
      root: 'card',
      elements: {
        card: { type: 'Text', props: { text: { $param: 'name' } } },
      },
    }));

    const specPath = join(copied, 'services', 'app', 'ui', 'screens', 'home.spec.json');
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    spec.elements.moduleCard = { $ref: 'module:platformUi/fragments/service-card', bind: { name: 'pricing' } };
    spec.elements.page.children = [...spec.elements.page.children, 'moduleCard'];
    writeFileSync(specPath, JSON.stringify(spec, null, 2));

    const result = await loadComposedBlueprint(copied);

    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;
    const compiled = JSON.stringify(result.value.services.app?.compiledUi?.screens['home']?.spec);
    expect(compiled).not.toContain('$ref');
    expect(compiled).not.toContain('$param');
    expect(compiled).toContain('pricing');
  });

  it('fails when UI references an unexported module preset path', async () => {
    const copied = copyFixture();
    const projectPath = join(copied, 'project.json');
    const project = JSON.parse(readFileSync(projectPath, 'utf8'));
    project.modules = {
      ...(project.modules ?? {}),
      platformUi: { package: '@rntme/platform-ui' },
    };
    writeFileSync(projectPath, JSON.stringify(project, null, 2));
    mkdirSync(join(copied, 'node_modules', '@rntme', 'platform-ui'), { recursive: true });
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'package.json'), JSON.stringify({ name: '@rntme/platform-ui' }));
    mkdirSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'styles'), { recursive: true });
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'styles', 'main.css'), '/* empty */');
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'module.json'), JSON.stringify({
      name: '@rntme/platform-ui',
      version: '0.0.0',
      client: {
        presets: [],
        assets: { stylesheets: [{ id: 'main', path: 'styles/main.css' }] },
      },
    }));

    const specPath = join(copied, 'services', 'app', 'ui', 'screens', 'home.spec.json');
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    spec.elements.missing = { $ref: 'module:platformUi/fragments/missing', bind: {} };
    spec.elements.page.children = [...spec.elements.page.children, 'missing'];
    writeFileSync(specPath, JSON.stringify(spec, null, 2));

    const result = await loadComposedBlueprint(copied);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const uiError = result.errors.find((error) => error.code === 'BLUEPRINT_SERVICE_UI_INVALID');
      expect(uiError?.cause).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'EXTERNAL_REF_UNRESOLVED' })]));
    }
  });

  it('loads project-level init artifact during composition', async () => {
    const copied = copyFixture();
    mkdirSync(join(copied, 'init', 'files'), { recursive: true });
    writeFileSync(join(copied, 'init', 'project-initialized.bpmn'), '<definitions />');
    const seedText = readFileSync(
      join(copied, 'services', 'pricing', 'seed', 'seed.json'),
      'utf8',
    );
    writeFileSync(join(copied, 'init', 'files', 'pricing.seed.json'), seedText);
    writeFileSync(
      join(copied, 'init', 'init.json'),
      JSON.stringify(
        {
          initVersion: 1,
          process: {
            kind: 'bpmn',
            definition: 'project-initialized.bpmn',
            processId: 'ProjectInitialized',
          },
          steps: [
            {
              id: 'pricing.initial',
              type: 'init',
              provider: 'seed-events',
              targetService: 'pricing',
              mode: 'lifecycle',
              input: { path: 'files/pricing.seed.json' },
              dependsOn: [],
            },
          ],
        },
        null,
        2,
      ),
    );

    const r = await loadComposedBlueprint(copied);
    expect(r.ok, r.ok ? '' : JSON.stringify(r.errors)).toBe(true);
    if (!r.ok) return;
    expect(r.value.init?.steps[0]?.id).toBe('pricing.initial');
  });
});
