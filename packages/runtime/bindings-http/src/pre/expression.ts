export type ExpressionScope = {
  body?: Record<string, unknown>;
  form?: Record<string, unknown>;
  query?: Record<string, unknown>;
  header?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  config?: Record<string, unknown>;
  system?: Record<string, unknown>;
  pre?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: Record<string, unknown>;
};

const KNOWN_ROOTS: readonly (keyof ExpressionScope)[] = ['body', 'form', 'query', 'header', 'auth', 'config', 'system', 'pre', 'result', 'error'];

export function evaluateExpression(template: unknown, scope: ExpressionScope): unknown {
  if (typeof template === 'string') {
    if (template.length > 0 && template[0] === '$') {
      return resolveRef(template.slice(1), scope);
    }
    return template;
  }
  if (Array.isArray(template)) {
    return template.map((item) => evaluateExpression(item, scope));
  }
  if (template !== null && typeof template === 'object') {
    // Use a null-prototype object so writing user-controlled keys like
    // `__proto__` cannot mutate Object.prototype on the returned value.
    const out = Object.create(null) as Record<string, unknown>;
    for (const [k, v] of Object.entries(template as Record<string, unknown>)) {
      out[k] = evaluateExpression(v, scope);
    }
    return out;
  }
  return template;
}

function resolveRef(path: string, scope: ExpressionScope): unknown {
  const parts = path.split('.');
  const root = parts[0] as keyof ExpressionScope | undefined;
  if (root === undefined || !KNOWN_ROOTS.includes(root)) {
    throw new Error(`unknown scope root in reference "$${path}"`);
  }
  let current: unknown = scope[root];
  for (let i = 1; i < parts.length; i++) {
    if (current === null || current === undefined || typeof current !== 'object') {
      throw new Error(`unknown path in reference "$${path}" at segment "${parts.slice(0, i + 1).join('.')}"`);
    }
    const key = parts[i]!;
    // Use hasOwnProperty.call so inherited props (e.g. `constructor`,
    // `toString`) on user-controlled scope values don't satisfy the lookup.
    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      throw new Error(`unknown path in reference "$${path}" at segment "${parts.slice(0, i + 1).join('.')}"`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
