import type { UiError } from '../types/result.js';
import type { ModuleActionDef, ScreenDescriptor } from '../types/source.js';
import type { CompiledSpec } from '../types/compiled.js';
import type { ExpandedSource } from '../expand/expand.js';
import type { PropSchema, ValidateResolvers } from './resolvers-type.js';

/** Collect all $state paths used in a spec by deep-walking props */
function collectStatePaths(spec: CompiledSpec): Set<string> {
  const paths = new Set<string>();

  function walk(value: unknown): void {
    if (value === null || value === undefined || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
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

function collectStatePathsFromScreen(screen: ScreenDescriptor): Set<string> {
  const paths = new Set<string>();
  function walk(value: unknown): void {
    if (value === null || value === undefined || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const obj = value as Record<string, unknown>;
    if ('$state' in obj && typeof obj['$state'] === 'string') {
      paths.add(obj['$state']);
      return;
    }
    Object.values(obj).forEach(walk);
  }
  if (!screen.actions) return paths;
  for (const action of Object.values(screen.actions)) {
    if (action.kind === 'module-action' && action.params) walk(action.params);
  }
  return paths;
}

function isStateRef(v: unknown): v is { $state: string } {
  return !!v && typeof v === 'object' && '$state' in (v as object);
}

function literalMatchesSchema(value: unknown, schema: PropSchema): boolean {
  if (schema.array) return Array.isArray(value);
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

function propIsBound(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'object' && '$state' in (value as object)) return true;
  return true;
}

function validateOneModuleAction(
  action: ModuleActionDef,
  actionId: string,
  screenKey: string,
  contextPrefix: 'screen' | 'layout',
  spec: CompiledSpec,
  resolvers: ValidateResolvers,
  errors: UiError[],
): void {
  const path = `${contextPrefix}:${screenKey}/actions/${actionId}`;

  let module = action.module;
  if (!module && action.category) {
    module = resolvers.resolveCategoryToModule(action.category);
    if (!module) {
      errors.push({
        code: 'CATEGORY_NOT_MAPPED',
        message: `category "${action.category}" is not mapped to any module in project.json#modules`,
        path,
      });
      return;
    }
  }

  let targetElementType: string | undefined;
  if (action.target) {
    const targetEl = spec.elements[action.target];
    if (!targetEl) {
      errors.push({
        code: 'MODULE_ACTION_TARGET_MISSING',
        message: `target element "${action.target}" not found in ${contextPrefix} ${screenKey}`,
        path,
      });
      return;
    }
    targetElementType = targetEl.type;
  }

  const opOpts: {
    module?: string;
    category?: string;
    targetElementType?: string;
  } = {};
  if (module !== undefined) opOpts.module = module;
  if (action.category !== undefined) opOpts.category = action.category;
  if (targetElementType !== undefined) opOpts.targetElementType = targetElementType;

  const op = resolvers.resolveOperation(action.name, opOpts);
  if (!op) {
    errors.push({
      code: 'UNKNOWN_OPERATION',
      message: `operation "${action.name}" not registered by any module`,
      path,
    });
    return;
  }

  if (op.appliesTo !== null) {
    if (!action.target) {
      errors.push({
        code: 'MODULE_ACTION_NEEDS_TARGET',
        message: `operation "${action.name}" is component-bound (appliesTo: ${op.appliesTo.join(',')}); action requires "target"`,
        path,
      });
      return;
    }
    const targetEl = spec.elements[action.target]!;
    if (!op.appliesTo.includes(targetEl.type)) {
      errors.push({
        code: 'MODULE_ACTION_TARGET_TYPE_MISMATCH',
        message: `target "${action.target}" has type "${targetEl.type}" but operation "${action.name}" only applies to: ${op.appliesTo.join(',')}`,
        path,
      });
      return;
    }
  } else {
    if (action.target) {
      errors.push({
        code: 'MODULE_ACTION_AMBIGUOUS_ADDRESSING',
        message: `operation "${action.name}" is module-level but action has "target"`,
        path,
      });
      return;
    }
    if (!action.module && !action.category) {
      errors.push({
        code: 'MODULE_ACTION_NEEDS_MODULE',
        message: `module-level operation "${action.name}" requires "module" or "category"`,
        path,
      });
      return;
    }
  }

  for (const [paramName, schema] of Object.entries(op.params)) {
    const value = action.params?.[paramName];
    if (schema.required && value === undefined) {
      errors.push({
        code: 'MODULE_ACTION_PARAM_REQUIRED',
        message: `required parameter "${paramName}" missing for operation "${action.name}"`,
        path,
      });
      continue;
    }
    if (value !== undefined && !isStateRef(value) && !literalMatchesSchema(value, schema)) {
      errors.push({
        code: 'MODULE_ACTION_PARAM_TYPE_MISMATCH',
        message: `parameter "${paramName}" expected ${schema.type}; got ${typeof value}`,
        path,
      });
    }
  }
}

export function validateModuleActions(
  expanded: ExpandedSource,
  resolvers: ValidateResolvers,
  errors: UiError[],
): void {
  for (const [name, layout] of Object.entries(expanded.layouts)) {
    const { spec, screen } = layout;
    if (!screen.actions) continue;
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind !== 'module-action') continue;
      validateOneModuleAction(action, actionId, name, 'layout', spec, resolvers, errors);
    }
  }
  for (const [name, screenWith] of Object.entries(expanded.screens)) {
    const { spec, screen } = screenWith;
    if (!screen.actions) continue;
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind !== 'module-action') continue;
      validateOneModuleAction(action, actionId, name, 'screen', spec, resolvers, errors);
    }
  }
}

export function validateComponentTypesAndProps(
  expanded: ExpandedSource,
  resolvers: ValidateResolvers,
  errors: UiError[],
): void {
  for (const [name, { spec }] of Object.entries(expanded.layouts)) {
    for (const [elKey, el] of Object.entries(spec.elements)) {
      const componentInfo = resolvers.resolveComponent(el.type);
      if (!componentInfo) {
        errors.push({
          code: 'UNKNOWN_COMPONENT_TYPE',
          message: `unknown component type "${el.type}"`,
          path: `layout:${name}/elements/${elKey}`,
        });
        continue;
      }
      const propsSchema = componentInfo.props ?? {};
      for (const [propName, schema] of Object.entries(propsSchema)) {
        if (!schema.required) continue;
        const val = el.props[propName];
        if (!propIsBound(val)) {
          errors.push({
            code: 'PROP_REQUIRED_MISSING',
            message: `required prop "${propName}" not bound for component "${el.type}"`,
            path: `layout:${name}/elements/${elKey}`,
          });
        }
      }
    }
  }
  for (const [name, { spec }] of Object.entries(expanded.screens)) {
    for (const [elKey, el] of Object.entries(spec.elements)) {
      const componentInfo = resolvers.resolveComponent(el.type);
      if (!componentInfo) {
        errors.push({
          code: 'UNKNOWN_COMPONENT_TYPE',
          message: `unknown component type "${el.type}"`,
          path: `screen:${name}/elements/${elKey}`,
        });
        continue;
      }
      const propsSchema = componentInfo.props ?? {};
      for (const [propName, schema] of Object.entries(propsSchema)) {
        if (!schema.required) continue;
        const val = el.props[propName];
        if (!propIsBound(val)) {
          errors.push({
            code: 'PROP_REQUIRED_MISSING',
            message: `required prop "${propName}" not bound for component "${el.type}"`,
            path: `screen:${name}/elements/${elKey}`,
          });
        }
      }
    }
  }
}

/** Validate references: bindings exist, state paths are covered */
export function validateReferences(
  spec: CompiledSpec,
  screen: ScreenDescriptor,
  context: string,
  resolvers: ValidateResolvers,
): UiError[] {
  const errors: UiError[] = [];

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

  const statePaths = collectStatePaths(spec);
  for (const p of collectStatePathsFromScreen(screen)) statePaths.add(p);

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
      path.startsWith('/data/__error/') ||
      path.startsWith('/auth/') ||
      path === '/currentUser';
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
