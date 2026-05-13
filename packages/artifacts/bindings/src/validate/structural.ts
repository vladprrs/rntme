import type { BindingArtifact, BindingEntry, HttpParameter, StructurallyValid } from '../types/artifact.js';
import type { ResponseBranch } from '../types/input-from.js';
import { err, ok, ERROR_CODES, type Result, type BindingsError } from '../types/result.js';

const PLACEHOLDER_RE = /\{([^{}]+)\}/g;
const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function extractPathPlaceholders(path: string): string[] {
  const names: string[] = [];
  for (const match of path.matchAll(PLACEHOLDER_RE)) {
    if (match[1] !== undefined) names.push(match[1]);
  }
  return names;
}

type RedirectTarget = {
  value: string;
  /** True for object form `{ expr: "..." }` — bare `$ref` is the whole point. */
  allowBareReference: boolean;
};

function redirectTemplateTargets(redirect: unknown): RedirectTarget[] {
  if (typeof redirect === 'string') {
    return [{ value: redirect, allowBareReference: false }];
  }
  if (
    redirect !== null
    && typeof redirect === 'object'
    && 'expr' in redirect
    && typeof (redirect as { expr?: unknown }).expr === 'string'
  ) {
    return [{ value: (redirect as { expr: string }).expr, allowBareReference: true }];
  }
  return [];
}

function isAbsoluteUrl(s: string): boolean {
  return ABSOLUTE_URL_RE.test(s);
}

function isProtocolRelativeUrl(s: string): boolean {
  return s.startsWith('//');
}

function originOf(url: string): string | null {
  try {
    const parsed = new globalThis.URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function containsBareReference(tpl: string): boolean {
  return /(^|[^{])\$[a-zA-Z0-9_.-]+/.test(tpl);
}

function isSafeHeaderName(name: string): boolean {
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name);
}

function isSafeStaticHeaderValue(value: unknown): boolean {
  if (typeof value !== 'string') return true;
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code === 0x09) continue;
    if (code < 0x20 || code === 0x7f) return false;
  }
  return true;
}

function checkResponseHeaders(
  id: string,
  branchName: 'onOk' | 'onErr',
  branch: ResponseBranch,
  errors: BindingsError[],
): void {
  const headers = branch.headers ?? {};
  for (const [name, value] of Object.entries(headers)) {
    if (!isSafeHeaderName(name)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_STRUCTURAL_RESPONSE_HEADER_UNSAFE,
        message: `binding "${id}": response.${branchName}.headers has unsafe header name "${name}"`,
        path: `bindings.${id}.response.${branchName}.headers.${name}`,
      });
    }
    if (!isSafeStaticHeaderValue(value)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_STRUCTURAL_RESPONSE_HEADER_UNSAFE,
        message: `binding "${id}": response.${branchName}.headers.${name} contains an unsafe static value`,
        path: `bindings.${id}.response.${branchName}.headers.${name}`,
      });
    }
  }
}

function checkBinding(
  id: string,
  entry: BindingEntry,
  errors: BindingsError[],
): void {
  const basePath = `bindings.${id}.http`;
  const paramPath = (i: number) => `${basePath}.parameters[${i}]`;
  const { method, path, parameters } = entry.http;
  const isAction = entry.exposure === 'action';
  if (isAction && method !== 'POST') {
    const hasRedirect =
      entry.response !== undefined
      && ('redirect' in entry.response.onOk || 'redirect' in entry.response.onErr);
    if (method === 'GET' && hasRedirect) {
      // GET is allowed on command bindings when response has redirect
    } else if (method === 'GET' && !hasRedirect) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_STRUCTURAL_GET_COMMAND_WITHOUT_REDIRECT,
          message: `binding "${id}": GET is only allowed on action bindings when response.onOk or response.onErr is a redirect`,
        path: `${basePath}.method`,
        hint: 'Vendor-callback bindings (OAuth, magic link) use GET + redirect. Normal commands are POST + json.',
      });
    } else {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_COMMAND_METHOD_NOT_POST,
          message: `Action binding "${id}" must use method=POST (got ${method})`,
        path: `${basePath}.method`,
      });
    }
  }

  // (in, name) uniqueness
  const seenName = new Set<string>();
  const seenBindTo = new Set<string>();
  parameters.forEach((p: HttpParameter, i: number) => {
    const key = `${p.in}:${p.name}`;
    if (seenName.has(key)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_DUPLICATE_PARAM_NAME,
        message: `Duplicate parameter (in=${p.in}, name="${p.name}") in binding "${id}"`,
        path: paramPath(i),
      });
    }
    seenName.add(key);

    if (seenBindTo.has(p.bindTo)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_DUPLICATE_BIND_TO,
        message: `Duplicate bindTo "${p.bindTo}" in binding "${id}"`,
        path: paramPath(i),
      });
    }
    seenBindTo.add(p.bindTo);

    if (p.in === 'path' && p.required !== true) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_PATH_NOT_REQUIRED,
        message: `Path parameter "${p.name}" must be required`,
        path: paramPath(i),
      });
    }

    if (method === 'GET' && p.in === 'body') {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_BODY_ON_GET,
        message: `GET binding "${id}" cannot have body parameters`,
        path: paramPath(i),
      });
    }

    if (isAction && p.in === 'query') {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_COMMAND_QUERY_PARAM_FORBIDDEN,
        message: `Action binding "${id}" cannot have query parameters (parameter "${p.name}")`,
        path: paramPath(i),
      });
    }
  });

  // path placeholders ↔ path parameters symmetric
  const placeholders = new Set(extractPathPlaceholders(path));
  const pathParams = new Set(parameters.filter((p) => p.in === 'path').map((p) => p.name));
  const missingParams = [...placeholders].filter((name) => !pathParams.has(name));
  const extraParams = [...pathParams].filter((name) => !placeholders.has(name));
  if (missingParams.length > 0 || extraParams.length > 0) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.BINDINGS_PATH_PLACEHOLDER_MISMATCH,
      message:
        `Path placeholders and parameters disagree in binding "${id}". ` +
        `Missing params: [${missingParams.join(', ')}]; extra params: [${extraParams.join(', ')}]`,
      path: `${basePath}.path`,
    });
  }

  // `body`-sourced inputFrom on a GET request is impossible.
  if (isAction && method === 'GET' && entry.inputFrom !== undefined) {
    for (const [graphInput, src] of Object.entries(entry.inputFrom)) {
      if (src.from === 'body' || src.from === 'form') {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.BINDINGS_STRUCTURAL_INPUT_FROM_BODY_ON_GET,
          message: `binding "${id}": inputFrom.${graphInput}.from="${src.from}" is not allowed on GET`,
          path: `bindings.${id}.inputFrom.${graphInput}`,
        });
      }
    }
  }

  // inputFrom keys must not overlap with parameters[].bindTo
  if (entry.inputFrom !== undefined) {
    const paramBindTos = new Set(entry.http.parameters.map((p) => p.bindTo));
    for (const inputName of Object.keys(entry.inputFrom)) {
      if (paramBindTos.has(inputName)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.BINDINGS_STRUCTURAL_INPUT_FROM_DUPLICATE,
          message: `binding "${id}": graph-input "${inputName}" is bound by both inputFrom and parameters[]`,
          path: `bindings.${id}.inputFrom.${inputName}`,
        });
      }
    }
  }

  if (entry.response !== undefined) {
    checkResponseHeaders(id, 'onOk', entry.response.onOk, errors);
    checkResponseHeaders(id, 'onErr', entry.response.onErr, errors);

    const redirects = [
      ...redirectTemplateTargets((entry.response.onOk as { redirect?: unknown }).redirect),
      ...redirectTemplateTargets((entry.response.onErr as { redirect?: unknown }).redirect),
    ];

    for (const { value: tpl, allowBareReference } of redirects) {
      if (!allowBareReference && containsBareReference(tpl)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.BINDINGS_STRUCTURAL_REDIRECT_STRING_CONTAINS_BARE_REFERENCE,
          message: `binding "${id}": string redirect contains bare "$reference"`,
          path: `bindings.${id}.response`,
          hint: 'Use object form: redirect: { expr: "$result.url" }.',
        });
      }

      if (isProtocolRelativeUrl(tpl)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.BINDINGS_STRUCTURAL_REDIRECT_PROTOCOL_RELATIVE,
          message: `binding "${id}": protocol-relative redirect "${tpl}" is not allowed (browsers treat it as cross-origin)`,
          path: `bindings.${id}.response`,
        });
        continue;
      }

      if (isAbsoluteUrl(tpl)) {
        const origin = originOf(tpl);
        const allow = entry.allowedRedirectHosts ?? [];
        if (origin === null || !allow.includes(origin)) {
          errors.push({
            layer: 'structural',
            code: ERROR_CODES.BINDINGS_STRUCTURAL_REDIRECT_ABSOLUTE_HOST_NOT_ALLOWED,
            message: `binding "${id}": absolute redirect to "${origin ?? tpl}" is not in allowedRedirectHosts`,
            path: `bindings.${id}.response`,
          });
        }
      }
    }
  }
}

export function validateStructural(artifact: BindingArtifact): Result<StructurallyValid> {
  const errors: BindingsError[] = [];
  const artifactWithShapes = artifact as BindingArtifact & { shapes?: Record<string, unknown> };

  // method + path uniqueness across all bindings
  const seenMethodPath = new Map<string, string>();
  for (const [id, entry] of Object.entries(artifact.bindings)) {
    const key = `${entry.http.method} ${entry.http.path}`;
    const prev = seenMethodPath.get(key);
    if (prev !== undefined) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_DUPLICATE_METHOD_PATH,
        message: `Duplicate method+path "${key}": bindings "${prev}" and "${id}"`,
        path: `bindings.${id}.http.path`,
      });
    } else {
      seenMethodPath.set(key, id);
    }
  }

  for (const [id, entry] of Object.entries(artifact.bindings)) {
    checkBinding(id, entry, errors);
  }

  for (const shapeName of Object.keys(artifactWithShapes.shapes ?? {})) {
    if (shapeName === 'CommandResult') {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.BINDINGS_STRUCTURAL_RESERVED_SHAPE_NAME,
        message: `shape name "${shapeName}" is reserved`,
        path: `shapes.${shapeName}`,
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as unknown as StructurallyValid);
}
