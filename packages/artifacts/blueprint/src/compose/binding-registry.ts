import type { HttpEntry } from '@rntme/ui';
import type { RoutedBindingEntry } from '../types/artifact.js';

type BindingInput = {
  bindingId: string;
  method: 'GET' | 'POST';
  path: string;
  kind?: 'query' | 'command';
};

export function buildBindingRegistry(input: {
  httpBaseByService: Record<string, string>;
  bindingsByService: Record<string, readonly BindingInput[]>;
}): Record<string, RoutedBindingEntry> {
  const registry: Record<string, RoutedBindingEntry> = {};

  for (const [service, basePath] of Object.entries(input.httpBaseByService)) {
    for (const binding of input.bindingsByService[service] ?? []) {
      const qualifiedId = `${service}.${binding.bindingId}`;
      const entry: RoutedBindingEntry = {
        service,
        bindingId: binding.bindingId,
        qualifiedId,
        method: binding.method,
        path: joinHttpPath(basePath, binding.path),
      };
      if (binding.kind !== undefined) entry.kind = binding.kind;
      registry[qualifiedId] = entry;
    }
  }

  return registry;
}

export function resolveProjectBindingRef(
  registry: Record<string, RoutedBindingEntry>,
  currentService: string,
  ref: string,
): RoutedBindingEntry | undefined {
  const qualifiedId = ref.includes('.') ? ref : `${currentService}.${ref}`;
  return registry[qualifiedId];
}

export function buildUiHttpMap(
  registry: Record<string, RoutedBindingEntry>,
  currentService: string,
): Record<string, HttpEntry> {
  const httpMap: Record<string, HttpEntry> = {};

  for (const entry of Object.values(registry)) {
    httpMap[entry.qualifiedId] = { method: entry.method, path: entry.path };
    if (entry.service === currentService) {
      httpMap[entry.bindingId] = { method: entry.method, path: entry.path };
    }
  }

  return httpMap;
}

function joinHttpPath(basePath: string, bindingPath: string): string {
  const base = basePath === '/' ? '' : basePath.replace(/\/+$/, '');
  const path = bindingPath === '/' ? '' : bindingPath.replace(/^\/+/, '');
  const joined = `${base}/${path}`.replace(/\/{2,}/g, '/');
  return joined === '' ? '/' : joined;
}
