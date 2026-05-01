import { describe, it, expect } from 'vitest';
import { sanitizePreStepLogEvent } from '../../src/pre/log-sanitize.js';

describe('sanitizePreStepLogEvent', () => {
  it('redacts claims key recursively', () => {
    const out = sanitizePreStepLogEvent({
      pre_step: 'module-rpc',
      claims: { sub: 'user-123', email: 'a@b.c' },
      nested: { claims: { token: 'x' } },
    });
    expect(out.claims).toBe('[REDACTED]');
    expect((out.nested as Record<string, unknown>).claims).toBe('[REDACTED]');
  });

  it('keeps non-claims fields', () => {
    const out = sanitizePreStepLogEvent({
      pre_step: 'module-rpc',
      module: 'identity',
      result: 'ok',
    });
    expect(out.module).toBe('identity');
    expect(out.result).toBe('ok');
  });
});
