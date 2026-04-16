import type { CompiledSpec } from '../types/compiled.js';
import type { UiError } from '../types/result.js';

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
