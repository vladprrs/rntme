import type { UiError } from '../types/result.js';
import type { ScreenDescriptor } from '../types/source.js';
import type { CompiledSpec } from '../types/compiled.js';
import type { ValidateResolvers } from './index.js';

/** Collect all $state paths used in a spec by deep-walking props */
function collectStatePaths(spec: CompiledSpec): Set<string> {
  const paths = new Set<string>();

  function walk(value: unknown): void {
    if (value === null || value === undefined || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const obj = value as Record<string, unknown>;
    if ('$state' in obj && typeof obj['$state'] === 'string') {
      paths.add(obj['$state']);
      return;
    }
    Object.values(obj).forEach(walk);
  }

  for (const el of Object.values(spec.elements)) {
    walk(el.props);
    walk(el.visible);
    walk(el.on);
    walk(el.watch);
  }
  return paths;
}

/** Validate references: bindings exist, state paths are covered */
export function validateReferences(
  spec: CompiledSpec,
  screen: ScreenDescriptor,
  context: string,
  resolvers: ValidateResolvers,
): UiError[] {
  const errors: UiError[] = [];

  // Check all bindings in data section exist
  if (screen.data) {
    for (const [statePath, db] of Object.entries(screen.data)) {
      const resolved = resolvers.resolveBinding(db.binding);
      if (!resolved) {
        errors.push({
          code: 'UNRESOLVED_BINDING',
          message: `Data binding "${db.binding}" for "${statePath}" not found in ${context}`,
          path: `${context}/data/${statePath}`,
        });
      }
    }
  }

  // Check all bindings in command actions exist
  if (screen.actions) {
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind === 'command') {
        const resolved = resolvers.resolveBinding(action.binding);
        if (!resolved) {
          errors.push({
            code: 'UNRESOLVED_BINDING',
            message: `Command binding "${action.binding}" for action "${actionId}" not found in ${context}`,
            path: `${context}/actions/${actionId}`,
          });
        }
      }
      if (action.kind === 'navigation' && action.navigateTo) {
        if (!resolvers.resolveRoute(action.navigateTo)) {
          errors.push({
            code: 'UNKNOWN_ROUTE',
            message: `Navigation target "${action.navigateTo}" not found for action "${actionId}" in ${context}`,
            path: `${context}/actions/${actionId}`,
          });
        }
      }
    }
  }

  // Check $state paths are covered by data bindings, form inputs, route params, or action statuses
  const statePaths = collectStatePaths(spec);
  const coveredPrefixes = new Set<string>();
  if (screen.data) {
    for (const statePath of Object.keys(screen.data)) {
      coveredPrefixes.add(statePath);
    }
  }

  for (const path of statePaths) {
    const isCovered =
      coveredPrefixes.has(path) ||
      path.startsWith('/form/') ||
      path.startsWith('/route/params/') ||
      path.startsWith('/actions/') ||
      path.startsWith('/data/__status/') ||
      path.startsWith('/data/__error/');
    if (!isCovered) {
      errors.push({
        code: 'UNCOVERED_STATE_PATH',
        message: `State path "${path}" in ${context} is not covered by any data binding, form, route param, or action status`,
        path: `${context}`,
      });
    }
  }

  return errors;
}
