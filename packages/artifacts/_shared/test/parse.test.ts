import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseWithSchema, formatZodPath, isOk, isErr } from '../src/index.js';

type DemoError = { code: string; message: string; path?: string };

const Schema = z
  .object({
    a: z.string(),
    nested: z.object({ b: z.number() }),
  })
  .strict();

describe('parseWithSchema', () => {
  it('returns ok for string input + valid JSON', () => {
    const json = JSON.stringify({ a: 'hi', nested: { b: 1 } });
    const r = parseWithSchema(json, Schema, {
      fromJson: (message) => ({ code: 'JSON', message }),
      fromIssue: (issue, path) => ({ code: 'SCHEMA', message: issue.message, ...(path ? { path } : {}) }),
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.a).toBe('hi');
      expect(r.value.nested.b).toBe(1);
    }
  });

  it('calls fromJson when string input is invalid JSON', () => {
    const r = parseWithSchema<unknown, DemoError>('{not json', Schema, {
      fromJson: (message) => ({ code: 'JSON', message }),
      fromIssue: (issue, path) => ({ code: 'SCHEMA', message: issue.message, ...(path ? { path } : {}) }),
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]?.code).toBe('JSON');
      expect(r.errors[0]?.message).toMatch(/JSON|json|Unexpected/);
    }
  });

  it('calls fromIssue when object input fails the schema (with `.`-joined path)', () => {
    const r = parseWithSchema<unknown, DemoError>(
      { a: 1, nested: { b: 'oops' } },
      Schema,
      {
        fromIssue: (issue, path) => ({
          code: 'SCHEMA',
          message: issue.message,
          ...(path !== undefined ? { path } : {}),
        }),
      },
    );
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      const paths = r.errors.map((e) => e.path).filter((p): p is string => p !== undefined).sort();
      expect(paths).toEqual(['a', 'nested.b']);
    }
  });

  it('without fromJson, string input is passed through to schema (not JSON-parsed)', () => {
    // Schema accepts string only when input is the string. Use a minimal string schema.
    const StringSchema = z.string();
    const r = parseWithSchema<string, DemoError>('hello', StringSchema, {
      fromIssue: (issue, path) => ({ code: 'SCHEMA', message: issue.message, ...(path ? { path } : {}) }),
    });
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe('hello');
  });

  it('falls back to issue.keys[0] for unrecognized-keys errors with empty path', () => {
    const r = parseWithSchema<unknown, DemoError>(
      { a: 'ok', nested: { b: 1 }, extra: 1, alsoExtra: 2 },
      Schema,
      {
        fromIssue: (issue, path) => ({
          code: 'SCHEMA',
          message: issue.message,
          ...(path !== undefined ? { path } : {}),
        }),
      },
    );
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      // The unrecognized-keys issue surfaces at the top level (empty path) but
      // the fallback uses issue.keys[0].
      const paths = r.errors.map((e) => e.path).filter((p): p is string => p !== undefined);
      expect(paths.length).toBeGreaterThan(0);
      // Must include 'extra' (or 'alsoExtra') from the keys array.
      expect(paths.some((p) => p === 'extra' || p === 'alsoExtra')).toBe(true);
    }
  });

  it('formatZodPath returns undefined for empty path and `.`-joined for non-empty', () => {
    expect(formatZodPath([])).toBeUndefined();
    expect(formatZodPath(['a', 'b'])).toBe('a.b');
    expect(formatZodPath(['list', 0, 'x'])).toBe('list.0.x');
  });
});
