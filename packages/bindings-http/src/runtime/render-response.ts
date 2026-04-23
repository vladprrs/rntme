import type { ResponseShape, ResponseBranch } from '@rntme/bindings';
import { evaluateExpression, type ExpressionScope } from '../pre/expression.js';

export type RenderedResponse =
  | { kind: 'json'; status: number; body: unknown }
  | { kind: 'redirect'; status: 302 | 303; location: string };

export type RenderScope = { result: unknown; error: unknown };

export function renderOkResponse(shape: ResponseShape, scope: RenderScope): RenderedResponse {
  return renderBranch(shape.onOk, scope, 200);
}

export function renderErrResponse(shape: ResponseShape, scope: RenderScope): RenderedResponse {
  return renderBranch(shape.onErr, scope, 400);
}

function renderBranch(branch: ResponseBranch, scope: RenderScope, defaultStatus: number): RenderedResponse {
  if ('json' in branch) {
    const body = evaluateExpression(branch.json, toExprScope(scope));
    return { kind: 'json', status: defaultStatus, body };
  }
  const locRaw = branch.redirect;
  const location = typeof locRaw === 'string'
    ? interpolateTemplate(locRaw, scope)
    : String(evaluateExpression(locRaw, toExprScope(scope)));
  return { kind: 'redirect', status: branch.status ?? 302, location };
}

function toExprScope(scope: RenderScope): ExpressionScope {
  return {
    result: (scope.result ?? {}) as Record<string, unknown>,
    error: (scope.error ?? {}) as Record<string, unknown>,
  };
}

function interpolateTemplate(tpl: string, scope: RenderScope): string {
  return tpl.replace(/\{\$([a-zA-Z0-9_.]+)\}/g, (_match, path: string): string => {
    const root = path.split('.')[0]!;
    const source = (scope as unknown as Record<string, unknown>)[root];
    if (source === undefined || source === null) return '';
    let current: unknown = source;
    const parts = path.split('.').slice(1);
    for (const p of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[p];
    }
    return current === undefined || current === null ? '' : String(current);
  });
}
