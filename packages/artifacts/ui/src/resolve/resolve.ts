import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, err, type Result, type UiError } from '../types/result.js';
import {
  isRefElement,
  type SourceManifest,
  type ScreenDescriptor,
  type SpecJson,
  type ResolvedSource,
} from '../types/source.js';

function readJson<T>(filePath: string): Result<T> {
  if (!existsSync(filePath)) {
    return err({ code: 'FILE_NOT_FOUND', message: `File not found: ${filePath}`, path: filePath });
  }
  try {
    return ok(JSON.parse(readFileSync(filePath, 'utf-8')) as T);
  } catch (e) {
    return err({ code: 'MANIFEST_INVALID', message: `Invalid JSON: ${filePath}: ${e}`, path: filePath });
  }
}

function readPair(baseDir: string, basePath: string): Result<{ spec: SpecJson; screen: ScreenDescriptor }> {
  const specPath = join(baseDir, `${basePath}.spec.json`);
  const screenPath = join(baseDir, `${basePath}.screen.json`);

  const specResult = readJson<SpecJson>(specPath);
  if (!specResult.ok) return specResult;

  const screenResult = readJson<ScreenDescriptor>(screenPath);
  if (!screenResult.ok) return screenResult;

  return ok({ spec: specResult.value, screen: screenResult.value });
}

/**
 * Collect all fragment base-paths referenced (transitively) from a set of specs.
 * Detects cycles and returns them as errors.
 */
function collectFragments(
  baseDir: string,
  specs: SpecJson[],
  fragments: Map<string, SpecJson>,
  visiting: Set<string>,
  errors: UiError[],
): void {
  for (const spec of specs) {
    for (const el of Object.values(spec.elements)) {
      if (!isRefElement(el)) continue;
      const refPath = el.$ref;

      if (visiting.has(refPath)) {
        errors.push({
          code: 'CIRCULAR_REF',
          message: `Circular fragment reference: ${[...visiting, refPath].join(' \u2192 ')}`,
          path: refPath,
        });
        return;
      }

      if (fragments.has(refPath)) continue;

      const filePath = join(baseDir, `${refPath}.spec.json`);
      const fragResult = readJson<SpecJson>(filePath);
      if (!fragResult.ok) {
        errors.push(...fragResult.errors);
        continue;
      }

      fragments.set(refPath, fragResult.value);
      visiting.add(refPath);
      collectFragments(baseDir, [fragResult.value], fragments, visiting, errors);
      visiting.delete(refPath);
    }
  }
}

export function resolve(baseDir: string): Result<ResolvedSource> {
  // 1. Read manifest
  const manifestResult = readJson<SourceManifest>(join(baseDir, 'manifest.json'));
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;

  // 2. Read layouts
  const layouts: Record<string, { spec: SpecJson; screen: ScreenDescriptor }> = {};
  for (const [name, basePath] of Object.entries(manifest.layouts)) {
    const pair = readPair(baseDir, basePath);
    if (!pair.ok) return pair;
    layouts[name] = pair.value;
  }

  // 3. Read screens
  const screens: Record<string, { spec: SpecJson; screen: ScreenDescriptor }> = {};
  for (const route of Object.values(manifest.routes)) {
    // Derive screen key from base path (last segment)
    const key = route.screen.split('/').pop()!;
    const pair = readPair(baseDir, route.screen);
    if (!pair.ok) return pair;
    screens[key] = pair.value;
  }

  // 4. Collect fragments (transitively, with cycle detection)
  const fragments = new Map<string, SpecJson>();
  const allSpecs = [
    ...Object.values(layouts).map((l) => l.spec),
    ...Object.values(screens).map((s) => s.spec),
  ];
  const errors: UiError[] = [];
  collectFragments(baseDir, allSpecs, fragments, new Set(), errors);
  if (errors.length > 0) return err(...errors);

  return ok({ manifest, baseDir, layouts, screens, fragments });
}
