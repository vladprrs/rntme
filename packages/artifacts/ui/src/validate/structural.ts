import type { CompiledSpec, CompiledElement } from '../types/compiled.js';
import type { UiError } from '../types/result.js';
import type { ModuleActionDef, ScreenDescriptor } from '../types/source.js';

/** Validate element tree structure: root exists, no orphans, children valid, slots only in layouts */
export function validateStructural(
  spec: CompiledSpec,
  context: string,
  isLayout: boolean,
): UiError[] {
  const errors: UiError[] = [];
  const elements = spec.elements;

  // Root must exist
  if (!(spec.root in elements)) {
    errors.push({
      code: 'MISSING_ROOT',
      message: `Root element "${spec.root}" not found in ${context}`,
      path: context,
    });
    return errors;
  }

  // Collect all referenced children
  const referenced = new Set<string>([spec.root]);
  for (const el of Object.values(elements)) {
    for (const child of el.children ?? []) {
      referenced.add(child);
    }
  }

  // Check children point to existing elements
  for (const [key, el] of Object.entries(elements)) {
    for (const child of el.children ?? []) {
      if (!(child in elements)) {
        errors.push({
          code: 'BAD_CHILD_REF',
          message: `Element "${key}" references child "${child}" which does not exist in ${context}`,
          path: `${context}/${key}`,
        });
      }
    }
  }

  // Orphan detection
  for (const key of Object.keys(elements)) {
    if (!referenced.has(key)) {
      errors.push({
        code: 'ORPHAN_ELEMENT',
        message: `Element "${key}" is not referenced by any parent or root in ${context}`,
        path: `${context}/${key}`,
      });
    }
  }

  // Slot elements only allowed in layouts
  if (!isLayout) {
    for (const [key, el] of Object.entries(elements)) {
      if (el.type === 'Slot') {
        errors.push({
          code: 'SLOT_NOT_IN_LAYOUT',
          message: `Slot element "${key}" found in screen ${context} — Slots are only allowed in layouts`,
          path: `${context}/${key}`,
        });
      }
    }
  }

  return errors;
}

function validateModuleAction(action: ModuleActionDef, pathPrefix: string, errors: UiError[]): void {
  const hasTarget = !!action.target;
  const hasModule = !!action.module;
  const hasCategory = !!action.category;
  const addressingCount = Number(hasTarget) + Number(hasModule) + Number(hasCategory);

  if (addressingCount === 0) {
    errors.push({
      code: 'MODULE_ACTION_NEEDS_TARGET_OR_MODULE',
      message: 'module-action requires one of `target`, `module`, or `category`',
      path: pathPrefix,
    });
    return;
  }
  if (addressingCount > 1) {
    errors.push({
      code: 'MODULE_ACTION_AMBIGUOUS_ADDRESSING',
      message: 'module-action must set exactly one of `target`, `module`, or `category`',
      path: pathPrefix,
    });
    return;
  }
  if (!action.name || typeof action.name !== 'string') {
    errors.push({
      code: 'MODULE_ACTION_NEEDS_MODULE',
      message: 'module-action requires `name`',
      path: pathPrefix,
    });
  }
}

function isJsonRenderBinding(value: unknown): value is { action: string; params?: Record<string, unknown> } {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { action?: unknown }).action === 'string'
  );
}

function validateElementOn(el: CompiledElement, pathPrefix: string, errors: UiError[]): void {
  if (!el.on) return;
  for (const [evt, handler] of Object.entries(el.on)) {
    if (isJsonRenderBinding(handler)) continue;
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        if (!isJsonRenderBinding(handler[i])) {
          errors.push({
            code: 'ON_HANDLER_ARRAY_INVALID',
            message: `on.${evt}[${i}] must be a json-render action binding object`,
            path: `${pathPrefix}/on/${evt}/${i}`,
          });
        }
      }
      continue;
    }
    errors.push({
      code: 'ON_HANDLER_ARRAY_INVALID',
      message: `on.${evt} must be a json-render action binding object or an array of binding objects`,
      path: `${pathPrefix}/on/${evt}`,
    });
  }
}

function validateVisible(visible: unknown, pathPrefix: string, errors: UiError[]): void {
  if (visible === undefined) return;
  if (typeof visible !== 'object' || visible === null) {
    errors.push({
      code: 'VISIBLE_OPERATOR_UNKNOWN',
      message: 'visible must be an object',
      path: pathPrefix,
    });
    return;
  }
  const v = visible as Record<string, unknown>;
  if (typeof v.$state !== 'string') {
    errors.push({
      code: 'VISIBLE_OPERATOR_UNKNOWN',
      message: 'visible.$state must be a string path',
      path: pathPrefix,
    });
    return;
  }
  const known = ['$state', 'eq', 'contains', 'not'];
  for (const k of Object.keys(v)) {
    if (!known.includes(k)) {
      errors.push({
        code: 'VISIBLE_OPERATOR_UNKNOWN',
        message: `unknown visible operator "${k}"; expected one of: eq, contains, not`,
        path: pathPrefix,
      });
    }
  }
  if ('not' in v && v.not !== true) {
    errors.push({
      code: 'VISIBLE_OPERATOR_UNKNOWN',
      message: 'visible.not must equal true',
      path: pathPrefix,
    });
  }
}

/** Structural semantics: module-action screen actions, element `on` handlers, `visible` clauses */
export function validateSpecSemantics(
  spec: CompiledSpec,
  screen: ScreenDescriptor,
  context: string,
): UiError[] {
  const errors: UiError[] = [];

  if (screen.actions) {
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind === 'module-action') {
        validateModuleAction(action, `${context}/actions/${actionId}`, errors);
      }
    }
  }

  for (const [elKey, el] of Object.entries(spec.elements)) {
    validateVisible(el.visible, `${context}/elements/${elKey}/visible`, errors);
    validateElementOn(el, `${context}/elements/${elKey}`, errors);
  }

  return errors;
}
