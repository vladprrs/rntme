import type { JsonRenderElement } from '../types/artifact.js';
import type { StructurallyValid } from './structural.js';
import type { UiResolvers, ResolvedBinding, ResolvedComponent } from '../types/resolvers.js';
import { err, ok, UI_ERROR_CODES, type Result, type UiError } from '../types/result.js';

export type ResolvedUi = StructurallyValid & {
  __references: true;
  resolved: {
    bindings: Record<string, { route: string; id: string; binding: ResolvedBinding }>;
    components: Record<string, ResolvedComponent>;
  };
};

export function validateReferences(a: StructurallyValid, r: UiResolvers): Result<ResolvedUi> {
  const errors: UiError[] = [];
  const bindings: ResolvedUi['resolved']['bindings'] = {};
  const components: Record<string, ResolvedComponent> = {};

  for (const [path, route] of Object.entries(a.routes)) {
    if (route === undefined) continue;

    if (route.layout !== undefined && !a.layouts[route.layout]) {
      errors.push({
        layer: 'references',
        code: UI_ERROR_CODES.UI_UNKNOWN_LAYOUT,
        message: `Route "${path}" references missing layout "${route.layout}"`,
        path: `routes["${path}"].layout`,
      });
    }

    for (const [datasetId, def] of Object.entries(route.data ?? {})) {
      if (def === undefined) continue;
      const b = r.resolveBinding(def.binding);
      if (!b) {
        errors.push({
          layer: 'references',
          code: UI_ERROR_CODES.UI_UNRESOLVED_BINDING,
          message: `Dataset "${datasetId}" in route "${path}" references missing binding "${def.binding}"`,
          path: `routes["${path}"].data.${datasetId}.binding`,
        });
        continue;
      }
      if (b.kind !== 'query') {
        errors.push({
          layer: 'references',
          code: UI_ERROR_CODES.UI_BINDING_KIND_MISMATCH,
          message: `Dataset "${datasetId}" expects a query binding; "${def.binding}" is "${b.kind}"`,
          path: `routes["${path}"].data.${datasetId}.binding`,
        });
        continue;
      }
      bindings[`${path}#data#${datasetId}`] = { route: path, id: datasetId, binding: b };
    }

    for (const [actionId, action] of Object.entries(route.actions ?? {})) {
      if (action === undefined) continue;
      if (action.kind === 'command') {
        const b = r.resolveBinding(action.binding);
        if (!b) {
          errors.push({
            layer: 'references',
            code: UI_ERROR_CODES.UI_UNRESOLVED_BINDING,
            message: `Command action "${actionId}" in route "${path}" references missing binding "${action.binding}"`,
            path: `routes["${path}"].actions.${actionId}.binding`,
          });
          continue;
        }
        if (b.kind !== 'command') {
          errors.push({
            layer: 'references',
            code: UI_ERROR_CODES.UI_BINDING_KIND_MISMATCH,
            message: `Command action "${actionId}" expects a command binding; "${action.binding}" is "${b.kind}"`,
            path: `routes["${path}"].actions.${actionId}.binding`,
          });
          continue;
        }
        bindings[`${path}#action#${actionId}`] = { route: path, id: actionId, binding: b };
      } else {
        const expanded = action.navigateTo;
        const template = expanded.replace(/:[A-Za-z][A-Za-z0-9_]*/g, ':*');
        if (!r.resolveRoute(expanded) && !resolveTemplateAgainst(a.routes, template)) {
          errors.push({
            layer: 'references',
            code: UI_ERROR_CODES.UI_NAVIGATION_UNKNOWN_ROUTE,
            message: `Navigation action "${actionId}" targets unknown route "${action.navigateTo}"`,
            path: `routes["${path}"].actions.${actionId}.navigateTo`,
          });
        }
      }
    }

    checkComponentTypes(route.page.elements, r, components, errors, `routes["${path}"].page`);
  }

  for (const [id, layout] of Object.entries(a.layouts)) {
    if (layout === undefined) continue;
    checkComponentTypes(layout.spec.elements, r, components, errors, `layouts["${id}"].spec`);
  }

  if (errors.length) return err(errors);
  return ok({ ...(a as StructurallyValid), __references: true as const, resolved: { bindings, components } });
}

function resolveTemplateAgainst(routes: Record<string, unknown>, template: string): boolean {
  const normTemplate = template.replace(/:[A-Za-z][A-Za-z0-9_]*/g, ':*');
  for (const p of Object.keys(routes)) {
    if (p.replace(/:[A-Za-z][A-Za-z0-9_]*/g, ':*') === normTemplate) return true;
  }
  return false;
}

function checkComponentTypes(
  elements: Record<string, JsonRenderElement | undefined>,
  r: UiResolvers,
  acc: Record<string, ResolvedComponent>,
  errors: UiError[],
  basePath: string,
): void {
  for (const [id, el] of Object.entries(elements)) {
    if (el === undefined) continue;
    if (acc[el.type]) continue;
    const resolved = r.resolveComponent(el.type);
    if (!resolved) {
      errors.push({
        layer: 'references',
        code: UI_ERROR_CODES.UI_UNKNOWN_COMPONENT_TYPE,
        message: `Element "${id}" has unknown component type "${el.type}"`,
        path: `${basePath}.elements.${id}.type`,
      });
    } else {
      acc[el.type] = resolved;
    }
  }
}
