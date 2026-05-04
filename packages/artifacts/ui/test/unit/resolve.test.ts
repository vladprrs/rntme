import { describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolve } from '../../src/resolve/resolve.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

function copyFixture(name: string): string {
  const temp = mkdtempSync(join(tmpdir(), 'rntme-ui-'));
  const copied = join(temp, name);
  cpSync(join(fixtures, name), copied, { recursive: true });
  return copied;
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

describe('resolve', () => {
  it('resolves a minimal app with no fragments', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.manifest.version).toBe('2.0');
    expect(Object.keys(r.value.layouts)).toEqual(['main']);
    expect(Object.keys(r.value.screens)).toEqual(['home']);
    expect(r.value.fragments.size).toBe(0);
    expect(r.value.layouts['main']!.spec.root).toBe('shell');
    expect(r.value.screens['home']!.spec.root).toBe('page');
    expect(r.value.screens['home']!.screen.metadata?.title).toBe('Home');
  });

  it('resolves an app with fragments', () => {
    const r = resolve(join(fixtures, 'fragment-app'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fragments.size).toBe(1);
    expect(r.value.fragments.has('fragments/greeting')).toBe(true);
  });

  it('detects circular fragment references', () => {
    const r = resolve(join(fixtures, 'cycle-app'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]!.code).toBe('CIRCULAR_REF');
  });

  it('returns FILE_NOT_FOUND when manifest is missing', () => {
    const r = resolve(join(fixtures, 'nonexistent'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]!.code).toBe('FILE_NOT_FOUND');
  });

  it('returns FILE_NOT_FOUND when screen files are missing', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    expect(r.ok).toBe(true);
  });

  it('rejects a manifest with an unsupported version', () => {
    const copied = copyFixture('minimal-app');
    const manifestPath = join(copied, 'manifest.json');
    const manifest = readJson(manifestPath);
    manifest.version = '1.0';
    writeJson(manifestPath, manifest);

    const r = resolve(copied);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatchObject({ code: 'MANIFEST_INVALID', path: manifestPath });
    expect(r.errors[0]!.message).toContain('manifest.json failed schema validation');
  });

  it('rejects a spec file with an invalid element tree shape', () => {
    const copied = copyFixture('minimal-app');
    const specPath = join(copied, 'screens', 'home.spec.json');
    const spec = readJson(specPath);
    spec.root = 42;
    writeJson(specPath, spec);

    const r = resolve(copied);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatchObject({ code: 'SPEC_INVALID', path: specPath });
    expect(r.errors[0]!.message).toContain('spec file failed schema validation');
  });

  it('normalizes omitted element props to an empty object', () => {
    const copied = copyFixture('minimal-app');
    const specPath = join(copied, 'screens', 'home.spec.json');
    const spec = readJson(specPath);
    const elements = spec.elements as Record<string, Record<string, unknown>>;
    delete elements.page!.props;
    writeJson(specPath, spec);

    const r = resolve(copied);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.screens.home?.spec.elements.page).toMatchObject({ props: {} });
  });

  it('rejects a screen descriptor with an invalid action shape', () => {
    const copied = copyFixture('minimal-app');
    const screenPath = join(copied, 'screens', 'home.screen.json');
    const screen = readJson(screenPath);
    screen.actions = { submit: { kind: 'command' } };
    writeJson(screenPath, screen);

    const r = resolve(copied);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatchObject({ code: 'SCREEN_SCHEMA_INVALID', path: screenPath });
    expect(r.errors[0]!.message).toContain('screen descriptor failed schema validation');
  });

  it('rejects duplicate derived screen keys before overwriting screens', () => {
    const copied = copyFixture('minimal-app');
    const manifestPath = join(copied, 'manifest.json');
    const manifest = readJson(manifestPath);
    manifest.routes = {
      '/admin': { layout: 'main', screen: 'screens/admin/home' },
      '/public': { layout: 'main', screen: 'screens/public/home' },
    };
    writeJson(manifestPath, manifest);

    mkdirSync(join(copied, 'screens', 'admin'), { recursive: true });
    mkdirSync(join(copied, 'screens', 'public'), { recursive: true });
    cpSync(
      join(copied, 'screens', 'home.spec.json'),
      join(copied, 'screens', 'admin', 'home.spec.json'),
    );
    cpSync(
      join(copied, 'screens', 'home.screen.json'),
      join(copied, 'screens', 'admin', 'home.screen.json'),
    );
    cpSync(
      join(copied, 'screens', 'home.spec.json'),
      join(copied, 'screens', 'public', 'home.spec.json'),
    );
    cpSync(
      join(copied, 'screens', 'home.screen.json'),
      join(copied, 'screens', 'public', 'home.screen.json'),
    );

    const r = resolve(copied);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]).toMatchObject({
      code: 'DUPLICATE_SCREEN_KEY',
      path: 'screens/public/home',
    });
    expect(r.errors[0]!.message).toContain('home');
    expect(r.errors[0]!.message).toContain('screens/admin/home');
    expect(r.errors[0]!.message).toContain('screens/public/home');
  });
});
