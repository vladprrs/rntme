import type { ResponseShape, ResponseBranch } from '@rntme/bindings';
import { evaluateExpression, type ExpressionScope } from './expression.js';
import { errorToHttp } from './error-to-http.js';

export type RenderedResponse =
  | { kind: 'json'; status: number; body: unknown; headers: Record<string, string> }
  | { kind: 'redirect'; status: 302 | 303; location: string; headers: Record<string, string> };

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

export function renderErrResponse(
  shape: ResponseShape,
  scope: RenderScope,
  errorCode: string,
  status = errorToHttp(errorCode).status,
): RenderedResponse {
  return renderBranch(shape.onErr, scope, status);
}

function invalidRedirect(message: string): RenderedResponse {
  return {
    kind: 'json',
    status: 500,
    body: { code: 'BINDINGS_RUNTIME_INVALID_REDIRECT', message },
    headers: {},
  };
}

function invalidHeader(): RenderedResponse {
  return {
    kind: 'json',
    status: 500,
    body: {
      code: 'BINDINGS_RUNTIME_INVALID_RESPONSE_HEADER',
      message: 'response header value is invalid',
    },
    headers: {},
  };
}

const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function renderHeaders(branch: ResponseBranch, scope: RenderScope): Record<string, string> | null {
  const out: Record<string, string> = {};
  const headers = branch.headers;
  if (headers === undefined) return out;
  for (const [name, raw] of Object.entries(headers)) {
    if (!HEADER_NAME_RE.test(name)) return null;
    const evaluated = evaluateExpression(raw, toExprScope(scope));
    const value = evaluated === null || evaluated === undefined ? '' : String(evaluated);
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code === 0x09) continue;
      if (code < 0x20 || code === 0x7f) return null;
    }
    out[name] = value;
  }
  return out;
}

function renderBranch(branch: ResponseBranch, scope: RenderScope, defaultStatus: number): RenderedResponse {
  const headers = renderHeaders(branch, scope);
  if (headers === null) return invalidHeader();

  if ('json' in branch) {
    const body = evaluateExpression(branch.json, toExprScope(scope));
    const status = branch.status ?? defaultStatus;
    return { kind: 'json', status, body, headers };
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
  return { kind: 'redirect', status: branch.status ?? 302, location, headers };
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
