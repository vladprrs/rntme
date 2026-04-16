import type { ValidatedBindings } from '@rntme/bindings';

export type HttpBindingEntry = { method: 'GET' | 'POST'; path: string };

/** Maps binding id → HTTP method + path template (OpenAPI `{param}` style) for the SPA driver. */
export function buildResolvedHttp(validated: ValidatedBindings): Record<string, HttpBindingEntry> {
  const out: Record<string, HttpBindingEntry> = {};
  for (const [id, rb] of Object.entries(validated.resolved)) {
    out[id] = { method: rb.entry.http.method, path: rb.entry.http.path };
  }
  return out;
}
