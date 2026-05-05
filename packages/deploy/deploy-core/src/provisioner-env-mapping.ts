import type {
  ProvisionerEnvMapping,
  ResolvedEnvEntry,
} from '@rntme/contracts-provisioner-v1';

import type { ProvisionedModule } from './provision.js';

export function resolveEnvMappings(
  modules: ReadonlyMap<string, ProvisionedModule>,
  mappings: ProvisionerEnvMapping,
): ResolvedEnvEntry[] {
  const out: ResolvedEnvEntry[] = [];
  for (const [moduleKey, entries] of Object.entries(mappings)) {
    const provisioned = modules.get(moduleKey);
    if (!provisioned) continue;
    for (const entry of entries) {
      const bucket = entry.secret ? provisioned.secretOutputs : provisioned.publicOutputs;
      const expanded = expand(entry.from, bucket as Record<string, unknown>);
      for (const { value, name } of expanded) {
        out.push({
          module: moduleKey,
          target: entry.target,
          envName: substituteName(entry.envName, name),
          value: String(value),
          secret: entry.secret,
        });
      }
    }
  }
  return out;
}

type FrontierItem = { node: unknown; name?: string };

function expand(path: string, root: Record<string, unknown>): { value: unknown; name?: string }[] {
  const parts = path.split('.');
  let frontier: FrontierItem[] = [{ node: root }];
  for (const part of parts) {
    const next: FrontierItem[] = [];
    for (const f of frontier) {
      if (part === '*') {
        if (!Array.isArray(f.node)) {
          throw new Error(`env mapping path expansion: expected array at "*" in "${path}", got ${typeof f.node}`);
        }
        for (const item of f.node) {
          const hasName =
            typeof item === 'object' && item !== null && 'name' in item;
          const entry: FrontierItem = { node: item };
          if (hasName) {
            entry.name = String((item as { name: unknown }).name);
          }
          next.push(entry);
        }
      } else {
        if (typeof f.node !== 'object' || f.node === null) {
          throw new Error(`env mapping path "${path}": cannot read "${part}" of non-object`);
        }
        if (!(part in (f.node as Record<string, unknown>))) {
          throw new Error(`env mapping path "${path}": missing key "${part}"`);
        }
        const entry: FrontierItem = { node: (f.node as Record<string, unknown>)[part] };
        if (f.name !== undefined) {
          entry.name = f.name;
        }
        next.push(entry);
      }
    }
    frontier = next;
  }
  return frontier.map((f) => {
    const result: { value: unknown; name?: string } = { value: f.node };
    if (f.name !== undefined) {
      result.name = f.name;
    }
    return result;
  });
}

function substituteName(template: string, name: string | undefined): string {
  if (!template.includes('${name}')) return template;
  if (name === undefined) {
    throw new Error(`env mapping uses \${name} but the iterated value has no "name" field`);
  }
  return template.replace(/\$\{name\}/g, normalize(name));
}

function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
