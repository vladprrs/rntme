import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import { parseModuleManifest, type ModuleManifest } from '@rntme/module-skeleton';

import { ERROR_CODES, err, ok, type BlueprintError, type Result } from '../types/result.js';

export type DiscoveredModule = {
  manifest: ModuleManifest;
  packageDir: string;
  projectKey: string;
  publicConfig: Record<string, unknown>;
};

export function discoverModules(input: {
  projectDir: string;
  resolvePackage?: (packageName: string, projectDir: string) => string;
}): Result<Record<string, DiscoveredModule>> {
  const errors: BlueprintError[] = [];
  const out: Record<string, DiscoveredModule> = {};

  let projectRaw: unknown;
  try {
    projectRaw = JSON.parse(readFileSync(join(input.projectDir, 'project.json'), 'utf-8'));
  } catch (e) {
    return err([
      {
        layer: 'load',
        code: ERROR_CODES.BLUEPRINT_IO_ERROR,
        message: e instanceof Error ? e.message : String(e),
        path: 'project.json',
      },
    ]);
  }

  const modules =
    (projectRaw as { modules?: Record<string, { package: string; publicConfig?: Record<string, unknown> }> })
      .modules ?? {};

  const resolver = input.resolvePackage ?? defaultResolvePackage;

  for (const [projectKey, moduleRef] of Object.entries(modules)) {
    const packageName = moduleRef.package;

    let packageDir: string;
    try {
      packageDir = resolver(packageName, input.projectDir);
    } catch (e) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_MODULE_RESOLVE_FAILED,
        message: `module package "${packageName}" does not resolve from project (${e instanceof Error ? e.message : String(e)})`,
        path: `project.json#modules.${projectKey}`,
      });
      continue;
    }

    let manifestRaw: unknown;
    try {
      manifestRaw = JSON.parse(readFileSync(join(packageDir, 'module.json'), 'utf-8'));
    } catch (e) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_MODULE_MANIFEST_INVALID,
        message: `cannot read module.json for "${packageName}": ${e instanceof Error ? e.message : String(e)}`,
        path: `${packageName}/module.json`,
      });
      continue;
    }

    const parsed = parseModuleManifest(manifestRaw);
    if (!parsed.ok) {
      for (const p of parsed.errors) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_MANIFEST_INVALID,
          message: p.message,
          path: `${packageName}/module.json:${p.path}`,
        });
      }
      continue;
    }

    if (parsed.value.category !== undefined && parsed.value.category !== projectKey) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_CATEGORY_MISMATCH,
        message: `module "${packageName}" declares category "${parsed.value.category}" but is wired under project key "${projectKey}"`,
        path: `project.json#modules.${projectKey}`,
      });
      continue;
    }

    out[parsed.value.name] = {
      manifest: parsed.value,
      packageDir,
      projectKey,
      publicConfig: moduleRef.publicConfig ?? {},
    };
  }

  if (errors.length > 0) return err(errors);
  return ok(out);
}

/** Resolve the on-disk package root from the project, with exports-safe fallbacks. */
export function defaultResolvePackage(packageName: string, projectDir: string): string {
  const absProjectDir = resolve(projectDir);
  const projectRequire = createRequire(join(absProjectDir, 'project.json'));
  try {
    return dirname(projectRequire.resolve(`${packageName}/package.json`));
  } catch (error) {
    const fallback = join(absProjectDir, 'node_modules', ...packageName.split('/'), 'module.json');
    try {
      readFileSync(fallback);
      return dirname(fallback);
    } catch {
      try {
        return dirname(projectRequire.resolve(`${packageName}/module.json`));
      } catch {
        const workspaceDir = workspacePackageDir(packageName, absProjectDir);
        if (workspaceDir !== null) return workspaceDir;
        throw error;
      }
    }
  }
}

function workspacePackageDir(packageName: string, projectDir: string): string | null {
  const candidates = [
    join(projectDir, '..', '..'),
    join(projectDir, '..', '..', '..'),
  ];
  for (const root of candidates) {
    const dir = join(root, ...workspacePackagePathSegments(packageName));
    try {
      readFileSync(join(dir, 'module.json'));
      return resolve(dir);
    } catch {
      // Keep trying candidate roots.
    }
  }
  return null;
}

function workspacePackagePathSegments(packageName: string): string[] {
  if (packageName.startsWith('@rntme/identity-')) {
    return ['modules', 'identity', packageName.slice('@rntme/identity-'.length)];
  }
  return ['node_modules', ...packageName.split('/')];
}
