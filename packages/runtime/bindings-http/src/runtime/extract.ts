import type { Context } from 'hono';
import type { HttpParameter } from '@rntme/bindings';

/**
 * Query extraction.
 *
 * - `declared`: parameters declared in binding spec with `in: 'query'`.
 * - `listSet`: names of declared parameters whose input type is `list<T>`.
 *
 * Extraction policy:
 * - Declared list parameter → always array (empty if absent).
 * - Declared non-list parameter → single string (last wins if duplicated),
 *   or omitted entirely if not present on the request.
 * - Undeclared query keys → passed through as-is (single string, last wins).
 *   They will be rejected downstream by `.strict()` on the Zod schema.
 */
export function extractQuery(
  ctx: Context,
  declared: HttpParameter[],
  listSet: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  // ctx.req.queries() returns Record<string, string[]> with ALL occurrences.
  const all = ctx.req.queries();

  const declaredNames = new Set(declared.map((p) => p.name));

  // Declared parameters: apply list vs single rules
  for (const p of declared) {
    const vals = all[p.name];
    if (listSet.has(p.name)) {
      out[p.name] = vals ?? [];
    } else if (vals !== undefined && vals.length > 0) {
      out[p.name] = vals[vals.length - 1];
    }
    // else: absent — leave unset (optional/required handled by Zod)
  }

  // Undeclared: pass through as single (last-wins) so `.strict()` can flag them.
  for (const [name, vals] of Object.entries(all)) {
    if (declaredNames.has(name)) continue;
    if (vals.length > 0) {
      out[name] = vals[vals.length - 1];
    }
  }

  return out;
}

export function extractPath(ctx: Context, names: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const n of names) {
    const v = ctx.req.param(n);
    if (v !== undefined) out[n] = v;
  }
  return out;
}
