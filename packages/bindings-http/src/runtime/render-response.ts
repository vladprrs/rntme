import type { ResponseShape, ResponseBranch } from '@rntme/bindings';
import { evaluateExpression, type ExpressionScope } from '../pre/expression.js';
import { errorToHttp } from './error-to-http.js';

export type RenderedResponse =
  | { kind: 'json'; status: number; body: unknown }
  | { kind: 'redirect'; status: 302 | 303; location: string };

export type RenderScope = {
  result: unknown;
  error: unknown;
  body?: Record<string, unknown>;
  form?: Record<string, unknown>;
  query?: Record<string, unknown>;
  header?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

export function renderOkResponse(shape: ResponseShape, scope: RenderScope): RenderedResponse {
  return renderBranch(shape.onOk, scope, 200);
}

export function renderErrResponse(shape: ResponseShape, scope: RenderScope, errorCode: string): RenderedResponse {
  return renderBranch(shape.onErr, scope, errorToHttp(errorCode).status);
}

function invalidRedirect(message: string): RenderedResponse {
  return {
    kind: 'json',
    status: 500,
    body: { code: 'BINDINGS_RUNTIME_INVALID_REDIRECT', message },
  };
}

function renderBranch(branch: ResponseBranch, scope: RenderScope, defaultStatus: number): RenderedResponse {
  if ('json' in branch) {
    const body = evaluateExpression(branch.json, toExprScope(scope));
    return { kind: 'json', status: defaultStatus, body };
  }
  const locRaw = branch.redirect;
  let location: string;
  if (typeof locRaw === 'string') {
    location = interpolateTemplate(locRaw, scope);
  } else if (locRaw !== null && typeof locRaw === 'object' && 'expr' in locRaw) {
    const evaluated = evaluateExpression(locRaw.expr, toExprScope(scope));
    if (typeof evaluated !== 'string' || evaluated.length === 0) {
      return invalidRedirect('redirect expression must evaluate to a non-empty string');
    }
    location = evaluated;
  } else {
    return invalidRedirect('invalid redirect form');
  }
  if (location.length === 0) {
    return invalidRedirect('redirect template produced an empty Location');
  }
  return { kind: 'redirect', status: branch.status ?? 302, location };
}

function toExprScope(scope: RenderScope): ExpressionScope {
  return {
    body: scope.body ?? {},
    form: scope.form ?? {},
    query: scope.query ?? {},
    header: scope.header ?? {},
    auth: scope.auth ?? {},
    config: scope.config ?? {},
    result: (scope.result ?? {}) as Record<string, unknown>,
    error: (scope.error ?? {}) as Record<string, unknown>,
  };
}

function interpolateTemplate(tpl: string, scope: RenderScope): string {
  return tpl.replace(/\{\$([a-zA-Z0-9_.-]+)\}/g, (_match, path: string): string => {
    const root = path.split('.')[0]!;
    const source = (scope as unknown as Record<string, unknown>)[root];
    if (source === undefined || source === null) return '';
    let current: unknown = source;
    const parts = path.split('.').slice(1);
    for (const p of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return '';
      current = (current as Record<string, unknown>)[p];
    }
    return current === undefined || current === null ? '' : encodeURIComponent(String(current));
  });
}
