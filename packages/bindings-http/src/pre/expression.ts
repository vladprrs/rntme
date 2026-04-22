export type ExpressionScope = {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  config?: Record<string, unknown>;
  system?: Record<string, unknown>;
  pre?: Record<string, unknown>;
};

const KNOWN_ROOTS: readonly (keyof ExpressionScope)[] = ['body', 'query', 'auth', 'config', 'system', 'pre'];

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
    const out: Record<string, unknown> = {};
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
    if (!(key in (current as Record<string, unknown>))) {
      throw new Error(`unknown path in reference "$${path}" at segment "${parts.slice(0, i + 1).join('.')}"`);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}
