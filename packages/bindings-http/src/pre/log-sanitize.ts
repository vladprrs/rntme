/** Redact `claims` subtrees in pre-step log payloads (OIDC / JWT PII). */

export function sanitizePreStepLogEvent(evt: Record<string, unknown>): Record<string, unknown> {
  const out = redactClaims(evt);
  return typeof out === 'object' && out !== null && !Array.isArray(out) ? (out as Record<string, unknown>) : {};
}

function redactClaims(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => redactClaims(x));
  const o = v as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(o)) {
    if (k === 'claims') {
      next[k] = '[REDACTED]';
      continue;
    }
    next[k] = redactClaims(val);
  }
  return next;
}
