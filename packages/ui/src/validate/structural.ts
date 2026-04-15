import type { UiArtifactParsed } from '../parse/schema.js';
import { err, ok, UI_ERROR_CODES, type Result, type UiError } from '../types/result.js';

const PATH_RE =
  /^\/([A-Za-z0-9_-]+|:[A-Za-z][A-Za-z0-9_]*)(\/([A-Za-z0-9_-]+|:[A-Za-z][A-Za-z0-9_]*))*\/?$/;
const ROOT_PATH_RE = /^\/$/;
const BUILTIN_ACTIONS = new Set(['setState']);
const DATA_PREFIX_RE = /^\/data(\/__status|\/__error)?\/([^/]+)/;
const ACTION_PREFIX_RE = /^\/actions(\/__status|\/__error)\/([^/]+)/;

export type StructurallyValid = UiArtifactParsed & { __structural: true };

export function validateStructural(a: UiArtifactParsed): Result<StructurallyValid> {
  const errors: UiError[] = [];

  for (const path of Object.keys(a.routes)) {
    if (!ROOT_PATH_RE.test(path) && !PATH_RE.test(path)) {
      errors.push({
        layer: 'structural',
        code: UI_ERROR_CODES.UI_BAD_PATH_FORMAT,
        message: `Route path "${path}" is malformed (expected "/segment(/segment)*" with optional :name placeholders)`,
        path: `routes["${path}"]`,
      });
    }
  }

  for (const [path, route] of Object.entries(a.routes)) {
    if (route !== undefined) {
      checkSpec(route.page, `routes["${path}"].page`, errors);

      const declaredActions = new Set(Object.keys(route.actions ?? {}));
      const declaredData = new Set(Object.keys(route.data ?? {}));
      const { actions: usedActions, statePaths } = collectActionsAndStatePaths(route.page);

      for (const actionId of usedActions) {
        if (BUILTIN_ACTIONS.has(actionId)) continue;
        if (!declaredActions.has(actionId)) {
          errors.push({
            layer: 'structural',
            code: UI_ERROR_CODES.UI_UNKNOWN_ACTION,
            message: `Tree references action "${actionId}" which is not declared in route.actions`,
            path: `routes["${path}"].page`,
          });
        }
      }
      for (const sp of statePaths) {
        const d = DATA_PREFIX_RE.exec(sp);
        if (d) {
          const dsId = d[2];
          if (dsId && !declaredData.has(dsId)) {
            errors.push({
              layer: 'structural',
              code: UI_ERROR_CODES.UI_STATE_PATH_UNKNOWN_DATASET,
              message: `State path "${sp}" references dataset "${dsId}" not declared in route.data`,
              path: `routes["${path}"].page`,
            });
          }
        }
        const ac = ACTION_PREFIX_RE.exec(sp);
        if (ac) {
          const acId = ac[2];
          if (acId && !BUILTIN_ACTIONS.has(acId) && !declaredActions.has(acId)) {
            errors.push({
              layer: 'structural',
              code: UI_ERROR_CODES.UI_STATE_PATH_UNKNOWN_ACTION,
              message: `State path "${sp}" references action "${acId}" not declared in route.actions`,
              path: `routes["${path}"].page`,
            });
          }
        }
      }
    }
  }
  for (const [id, layout] of Object.entries(a.layouts)) {
    if (layout !== undefined) {
      checkSpec(layout.spec, `layouts["${id}"].spec`, errors);
    }
  }

  const usedLayouts = new Set<string>();
  for (const route of Object.values(a.routes)) {
    if (route.layout) usedLayouts.add(route.layout);
  }
  for (const layoutId of usedLayouts) {
    const layout = a.layouts[layoutId];
    if (!layout) continue; // reported by references layer
    const slots = Object.entries(layout.spec.elements).filter(([, e]) => e.type === 'Slot');
    if (slots.length === 0) {
      errors.push({
        layer: 'structural',
        code: UI_ERROR_CODES.UI_LAYOUT_SLOT_MISSING,
        message: `Layout "${layoutId}" is used but has no Slot element`,
        path: `layouts["${layoutId}"].spec`,
      });
    } else if (slots.length > 1) {
      errors.push({
        layer: 'structural',
        code: UI_ERROR_CODES.UI_LAYOUT_SLOT_DUPLICATE,
        message: `Layout "${layoutId}" has ${slots.length} Slot elements; exactly one is required`,
        path: `layouts["${layoutId}"].spec`,
      });
    }
  }

  return errors.length > 0 ? err(errors) : ok(a as StructurallyValid);
}

type JsonSpec = UiArtifactParsed['routes'][string];
type PageSpec = NonNullable<JsonSpec>['page'];

function collectActionsAndStatePaths(
  spec: PageSpec,
): { actions: Set<string>; statePaths: Set<string> } {
  const actions = new Set<string>();
  const statePaths = new Set<string>();
  const visitValue = (v: unknown): void => {
    if (v === null || v === undefined) return;
    if (typeof v !== 'object') return;
    if (Array.isArray(v)) {
      v.forEach(visitValue);
      return;
    }
    const obj = v as Record<string, unknown>;
    if (typeof obj.$state === 'string') statePaths.add(obj.$state);
    for (const [k, value] of Object.entries(obj)) {
      if (k === 'action' && typeof value === 'string') actions.add(value);
      visitValue(value);
    }
  };
  for (const el of Object.values(spec.elements)) {
    visitValue(el.props);
    if (el.watch) {
      for (const w of Object.values(
        el.watch as Record<string, { action: string; params?: Record<string, unknown> }>,
      )) {
        actions.add(w.action);
        if (w.params) visitValue(w.params);
      }
    }
    if (el.visible !== undefined) visitValue(el.visible);
  }
  return { actions, statePaths };
}

function checkSpec(spec: PageSpec, basePath: string, errors: UiError[]): void {
  if (!Object.prototype.hasOwnProperty.call(spec.elements, spec.root)) {
    errors.push({
      layer: 'structural',
      code: UI_ERROR_CODES.UI_MISSING_ROOT,
      message: `Root element id "${spec.root}" not found in elements map`,
      path: `${basePath}.root`,
    });
    return;
  }

  const reachable = new Set<string>();

  const walk = (id: string): void => {
    if (reachable.has(id)) return;
    const node = spec.elements[id];
    if (node === undefined) return;
    reachable.add(id);
    for (const childId of node.children) {
      if (!Object.prototype.hasOwnProperty.call(spec.elements, childId)) {
        errors.push({
          layer: 'structural',
          code: UI_ERROR_CODES.UI_BAD_CHILD_REF,
          message: `Element "${id}" references missing child "${childId}"`,
          path: `${basePath}.elements.${id}.children`,
        });
        continue;
      }
      walk(childId);
    }
  };

  walk(spec.root);

  for (const id of Object.keys(spec.elements)) {
    if (!reachable.has(id)) {
      errors.push({
        layer: 'structural',
        code: UI_ERROR_CODES.UI_ORPHAN_ELEMENT,
        message: `Element "${id}" is defined but not reachable from root`,
        path: `${basePath}.elements.${id}`,
      });
    }
  }
}
