import type { ZodIssue } from 'zod';
import { ManifestSchema } from './schema.js';
import type { ManifestError, ManifestResult, ParsedManifest } from './types.js';

function zodIssueToError(issue: ZodIssue): ManifestError {
  const path = issue.path.length === 0 ? '<root>' : issue.path.join('.');
  if (issue.code === 'unrecognized_keys') {
    return {
      code: 'MANIFEST_UNKNOWN_KEY',
      path: `${path}.${(issue as unknown as { keys: string[] }).keys.join(',')}`,
      message: `unknown key(s): ${(issue as unknown as { keys: string[] }).keys.join(', ')}`,
    };
  }
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return { code: 'MANIFEST_MISSING_FIELD', path, message: issue.message };
  }
  if (issue.code === 'invalid_type') {
    return { code: 'MANIFEST_INVALID_TYPE', path, message: issue.message };
  }
  if (issue.code === 'too_small' && issue.type === 'number') {
    return { code: 'MANIFEST_INVALID_PORT', path, message: issue.message };
  }
  return { code: 'MANIFEST_INVALID_TYPE', path, message: issue.message };
}

export function parseManifest(raw: string): ManifestResult<ParsedManifest> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return {
      ok: false,
      errors: [
        {
          code: 'MANIFEST_NOT_JSON',
          path: '<root>',
          message: e instanceof Error ? e.message : String(e),
        },
      ],
    };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      ok: false,
      errors: [
        { code: 'MANIFEST_NOT_OBJECT', path: '<root>', message: 'manifest must be a JSON object' },
      ],
    };
  }
  const result = ManifestSchema.safeParse(data);
  if (!result.success) {
    return { ok: false, errors: result.error.issues.map(zodIssueToError) };
  }
  return { ok: true, value: result.data as ParsedManifest };
}
