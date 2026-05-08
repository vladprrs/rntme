import type { ZodIssue, ZodType } from 'zod';

import { err, ok, type Result } from './result.js';

/**
 * Builders that map raw failure cases to a package-specific error type.
 *
 * - `fromJson` is invoked only when `input` is a string and `JSON.parse`
 *   throws. If absent, the helper does not run JSON.parse — the input is
 *   passed through to the schema as-is. (Used by `blueprint`/`seed`, which
 *   already receive an object.)
 * - `fromIssue` is invoked once per Zod issue. The helper precomputes the
 *   `path` argument with the canonical `.`-joined formatter plus the
 *   `workflows`-style `issue.keys` fallback for unrecognized-keys errors;
 *   consumers that need different formatting (e.g. `seed`'s `[N]` indexing)
 *   may ignore the `path` argument and re-derive from `issue.path`.
 */
export type ParseErrorBuilders<E> = {
  fromJson?: (message: string) => E;
  fromIssue: (issue: ZodIssue, path: string | undefined) => E;
};

/**
 * Format a Zod issue path with `.`-join for both string and numeric segments.
 * Returns `undefined` for an empty path so consumers can omit the field.
 *
 * Note: `seed` uses `[N]` for numeric segments — it formats inside its own
 * `fromIssue` callback rather than relying on this default.
 */
export function formatZodPath(path: readonly (string | number)[]): string | undefined {
  return path.length > 0 ? path.join('.') : undefined;
}

/**
 * Resolve the `path` argument passed to `fromIssue`. Falls back to
 * `issue.keys[0]` when the path is empty and the issue carries a `keys`
 * array (canonical `workflows`-style behaviour for `unrecognized_keys`).
 */
function resolveIssuePath(issue: ZodIssue): string | undefined {
  if (issue.path.length > 0) return issue.path.join('.');
  if ('keys' in issue && Array.isArray(issue.keys) && issue.keys.length > 0) {
    return String(issue.keys[0]);
  }
  return undefined;
}

/**
 * Run `string → JSON.parse → schema.safeParse → map issues` in one step.
 *
 * Replaces ~30 lines of nearly-identical boilerplate in each artifact
 * package's `parse.ts`. Each call site supplies the schema and an error
 * builder; this helper handles the JSON.parse branch, the safeParse branch,
 * and the canonical `path`/`issue.keys` formatting.
 */
export function parseWithSchema<T, E>(
  input: unknown,
  schema: ZodType<T>,
  builders: ParseErrorBuilders<E>,
): Result<T, E> {
  let candidate: unknown = input;

  if (builders.fromJson && typeof input === 'string') {
    try {
      candidate = JSON.parse(input) as unknown;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'invalid JSON';
      return err([builders.fromJson(message)]);
    }
  }

  const parsed = schema.safeParse(candidate);
  if (parsed.success) {
    return ok(parsed.data);
  }

  return err(
    parsed.error.issues.map((issue) => builders.fromIssue(issue, resolveIssuePath(issue))),
  );
}
