import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import { parseModuleManifest, type ModuleManifest } from '@rntme/contracts-module-v1';

import { ERROR_CODES, err, ok, type BlueprintError, type Result } from '../types/result.js';

export type DiscoveredModule = {
  manifest: ModuleManifest;
  packageDir: string;
  projectKey: string;
  publicConfig: Record<string, unknown>;
};

export async function discoverModules(input: {
  projectDir: string;
  resolvePackage?: (packageName: string, projectDir: string) => Promise<string> | string;
}): Promise<Result<Record<string, DiscoveredModule>>> {
  const errors: BlueprintError[] = [];
  const out: Record<string, DiscoveredModule> = {};

  let projectRaw: unknown;
  try {
    projectRaw = JSON.parse(await readFile(join(input.projectDir, 'project.json'), 'utf-8'));
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

  // Resolve package directories in parallel.
  const moduleEntries = Object.entries(modules);
  const resolved = await Promise.all(
    moduleEntries.map(async ([projectKey, moduleRef]) => {
      const packageName = moduleRef.package;
      try {
        const packageDir = await resolver(packageName, input.projectDir);
        return { projectKey, moduleRef, packageDir, error: null as null | Error };
      } catch (e) {
        return {
          projectKey,
          moduleRef,
          packageDir: '',
          error: e instanceof Error ? e : new Error(String(e)),
        };
      }
    }),
  );

  // Read each module.json in parallel.
  const manifestReads = await Promise.all(
    resolved.map(async (entry) => {
      if (entry.error !== null) return { entry, manifestRaw: null, readError: null };
      try {
        const manifestRaw = JSON.parse(
          await readFile(join(entry.packageDir, 'module.json'), 'utf-8'),
        );
        return { entry, manifestRaw, readError: null as null | Error };
      } catch (e) {
        return {
          entry,
          manifestRaw: null,
          readError: e instanceof Error ? e : new Error(String(e)),
        };
      }
    }),
  );

  for (const { entry, manifestRaw, readError } of manifestReads) {
    const { projectKey, moduleRef } = entry;
    const packageName = moduleRef.package;

    if (entry.error !== null) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_MODULE_RESOLVE_FAILED,
        message: `module package "${packageName}" does not resolve from project (${entry.error.message})`,
        path: `project.json#modules.${projectKey}`,
      });
      continue;
    }

    if (readError !== null) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_MODULE_MANIFEST_INVALID,
        message: `cannot read module.json for "${packageName}": ${readError.message}`,
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

    const allowedProjectKeys = new Set(
      [parsed.value.category, parsed.value.vendor].filter((value): value is string => value !== undefined),
    );
    if (allowedProjectKeys.size > 0 && !allowedProjectKeys.has(projectKey)) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_CATEGORY_MISMATCH,
        message: `module "${packageName}" declares category/vendor "${[...allowedProjectKeys].join('/')}" but is wired under project key "${projectKey}"`,
        path: `project.json#modules.${projectKey}`,
      });
      continue;
    }

    if (parsed.value.provisioner) {
      const moduleEntry = parsed.value.provisioner.entry;
      if (
        moduleEntry.startsWith('/') ||
        moduleEntry.startsWith('..') ||
        moduleEntry.includes('/../') ||
        moduleEntry.includes('\\..\\')
      ) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_PROVISIONER_BAD_ENTRY,
          message: `module "${packageName}" provisioner.entry "${moduleEntry}" must be a relative path inside the package`,
          path: `${packageName}/module.json:provisioner.entry`,
        });
        continue;
      }
    }

    out[parsed.value.name] = {
      manifest: parsed.value,
      packageDir: entry.packageDir,
      projectKey,
      publicConfig: moduleRef.publicConfig ?? {},
    };
  }

  if (errors.length > 0) return err(errors);
  return ok(out);
}

/** Resolve the on-disk package root from the project, with exports-safe fallbacks. */
export async function defaultResolvePackage(packageName: string, projectDir: string): Promise<string> {
  const absProjectDir = resolve(projectDir);
  const projectRequire = createRequire(join(absProjectDir, 'project.json'));
  try {
    return dirname(projectRequire.resolve(`${packageName}/package.json`));
  } catch (error) {
    const fallback = join(absProjectDir, 'node_modules', ...packageName.split('/'), 'module.json');
    try {
      await readFile(fallback);
      return dirname(fallback);
    } catch {
      try {
        return dirname(projectRequire.resolve(`${packageName}/module.json`));
      } catch {
        const workspaceDir = await workspacePackageDir(packageName, absProjectDir);
        if (workspaceDir !== null) return workspaceDir;
        throw error;
      }
    }
  }
}

async function workspacePackageDir(
  packageName: string,
  projectDir: string,
): Promise<string | null> {
  const candidates = [
    join(projectDir, '..', '..'),
    join(projectDir, '..', '..', '..'),
  ];
  for (const root of candidates) {
    const dir = join(root, ...workspacePackagePathSegments(packageName));
    try {
      await readFile(join(dir, 'module.json'));
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
