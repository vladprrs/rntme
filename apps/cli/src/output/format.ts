import type { CliError } from '../errors/codes.js';
import type { ClientError } from '../api/client.js';

export type OutputMode = 'human' | 'json';

export type SuccessOutput<T> = { ok: true; data: T };
export type FailureOutput = {
  ok: false;
  error: {
    code: string;
    status?: number | undefined;
    message: string;
    requestId?: string | undefined;
    hint?: string | undefined;
    nested?: Array<{ code: string; message: string; path?: string | undefined; pkg?: string | undefined; stage?: string | undefined; cause?: unknown }> | undefined;
  };
};

export function formatSuccess<T>(mode: OutputMode, data: T, human?: ((d: T) => string) | undefined): string {
  if (mode === 'json') {
    return JSON.stringify({ ok: true, data } satisfies SuccessOutput<T>);
  }
  return human ? human(data) : JSON.stringify(data, null, 2);
}

export function formatFailure(mode: OutputMode, fail: FailureOutput['error']): string {
  if (mode === 'json') {
    return JSON.stringify({ ok: false, error: fail } satisfies FailureOutput);
  }
  const lines = [`✖ ${fail.code}`, `  ${fail.message}`];
  if (fail.requestId) lines.push(`  request: ${fail.requestId}`);
  if (fail.nested) {
    lines.push('', 'Nested errors:');
    for (const n of fail.nested) {
      lines.push(`  • ${n.code}`);
      if (n.path) lines.push(`      at  ${n.path}`);
      lines.push(`      msg ${n.message}`);
    }
  }
  if (fail.hint) {
    lines.push('', `Hint: ${fail.hint}`);
  }
  return lines.join('\n');
}

export function toFailureOutput(e: CliError | ClientError): FailureOutput['error'] {
  if ('kind' in e && e.kind === 'cli') {
    return {
      code: e.code,
      message: e.message,
      hint: e.hint,
      nested: extractNestedFromCause(e.cause),
    };
  }
  if ('kind' in e && e.kind === 'network') {
    return { code: 'CLI_NETWORK_TIMEOUT', message: e.message };
  }
  if ('kind' in e && e.kind === 'http') {
    const missingScope = e.status === 403 ? e.message.match(/missing scope "?([^".\s]+)"?/)?.[1] : undefined;
    return {
      code: e.code,
      status: e.status,
      message: e.message,
      requestId: e.requestId,
      nested: e.nested,
      hint: missingScope === undefined ? undefined : `your token is missing scope "${missingScope}". Try: rntme token create deploy-bot --preset deploy`,
    };
  }
  return { code: 'PLATFORM_INTERNAL', message: 'unknown error' };
}

/**
 * When a CliError carries `cause` produced by upstream validators
 * (e.g. `@rntme/blueprint` returns `Result<…, { layer, code, message, path }[]>`),
 * surface each item as a nested entry so users see every failure with its
 * artifact path, not a semicolon-joined one-liner. See F046.
 */
function extractNestedFromCause(cause: unknown): FailureOutput['error']['nested'] {
  if (!Array.isArray(cause) || cause.length === 0) return undefined;
  const nested: NonNullable<FailureOutput['error']['nested']> = [];
  for (const item of cause) {
    if (item === null || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const code = typeof obj.code === 'string' ? obj.code : undefined;
    const message = typeof obj.message === 'string' ? obj.message : undefined;
    if (code === undefined || message === undefined) continue;
    const path = typeof obj.path === 'string' && obj.path !== '' ? obj.path : undefined;
    const pkg = typeof obj.pkg === 'string' ? obj.pkg : undefined;
    const stage = typeof obj.stage === 'string'
      ? obj.stage
      : typeof obj.layer === 'string'
        ? obj.layer
        : undefined;
    nested.push({ code, message, path, pkg, stage });
  }
  return nested.length > 0 ? nested : undefined;
}
