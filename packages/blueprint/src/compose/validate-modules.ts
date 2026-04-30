import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CatalogManifest } from '../types/artifact.js';
import type { PropSchema } from '../types/result.js';
import { ERROR_CODES, err, ok, type BlueprintError, type Result } from '../types/result.js';
import type { DiscoveredModule } from './modules.js';

function literalMatchesSchema(
  value: unknown,
  schema: { type: PropSchema['type']; required?: boolean | undefined; array?: boolean | undefined },
): boolean {
  if (schema.array === true) return Array.isArray(value);
  switch (schema.type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return false;
  }
}

export function validateModulePublicConfigs(
  discovered: Record<string, DiscoveredModule>,
): Result<void> {
  const errors: BlueprintError[] = [];

  for (const [moduleName, dm] of Object.entries(discovered)) {
    const schema = dm.manifest.client?.config?.schema;
    if (!schema) continue;

    for (const [key, prop] of Object.entries(schema)) {
      const v = dm.publicConfig[key];
      if (prop.required && v === undefined) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_PUBLIC_CONFIG_INVALID,
          message: `publicConfig missing required key "${key}" for module "${moduleName}"`,
          path: `project.json#modules.${dm.projectKey}.publicConfig`,
        });
        continue;
      }
      if (v !== undefined && !literalMatchesSchema(v, prop)) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_PUBLIC_CONFIG_INVALID,
          message: `publicConfig "${key}" for "${moduleName}" does not match declared type "${prop.type}"`,
          path: `project.json#modules.${dm.projectKey}.publicConfig.${key}`,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(undefined);
}

export function validateModuleClientExports(
  discovered: Record<string, DiscoveredModule>,
  catalog: CatalogManifest,
): Result<void> {
  const errors: BlueprintError[] = [];
  const needsClient = new Set<string>();
  for (const c of catalog.components) needsClient.add(c.module);
  for (const m of catalog.modulesWithBoot) needsClient.add(m);

  for (const moduleName of needsClient) {
    const dm = discovered[moduleName];
    if (!dm) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(dm.packageDir, 'package.json'), 'utf-8'));
    } catch (e) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_MODULE_ENTRY_EXPORT_MISSING,
        message: `cannot read package.json for "${moduleName}"`,
        path: join(dm.packageDir, 'package.json'),
      });
      continue;
    }
    const exportsField = (raw as { exports?: Record<string, unknown> }).exports;
    if (!exportsField || typeof exportsField !== 'object' || !('./client' in exportsField)) {
      errors.push({
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_MODULE_ENTRY_EXPORT_MISSING,
        message: `package "${moduleName}" must export subpath "./client" for the UI virtual entry`,
        path: join(dm.packageDir, 'package.json'),
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(undefined);
}

export function buildPublicConfigSidecar(
  discovered: Record<string, DiscoveredModule>,
): string | null {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [moduleName, dm] of Object.entries(discovered)) {
    if (dm.manifest.client?.config?.schema) {
      out[moduleName] = { ...dm.publicConfig };
    }
  }
  if (Object.keys(out).length === 0) return null;
  return `${JSON.stringify(out, null, 2)}
`;
}
