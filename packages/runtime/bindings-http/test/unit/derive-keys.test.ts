import { describe, it, expect } from 'vitest';
import { deriveCommandRunId, deriveStepKey } from '../../src/idempotency/derive-keys.js';

describe('idempotency key derivation', () => {
  it('deriveCommandRunId is deterministic for same (commandName, clientKey)', () => {
    const a = deriveCommandRunId('createOrder', 'abc');
    const b = deriveCommandRunId('createOrder', 'abc');
    expect(a).toBe(b);
  });
  it('deriveCommandRunId differs when commandName differs', () => {
    expect(deriveCommandRunId('a', 'k')).not.toBe(deriveCommandRunId('b', 'k'));
  });
  it('deriveStepKey is deterministic for same (runId, index)', () => {
    expect(deriveStepKey('r1', 0)).toBe(deriveStepKey('r1', 0));
  });
  it('deriveStepKey differs by index', () => {
    expect(deriveStepKey('r1', 0)).not.toBe(deriveStepKey('r1', 1));
  });
  it('deriveStepKey differs by runId', () => {
    expect(deriveStepKey('r1', 0)).not.toBe(deriveStepKey('r2', 0));
  });
});
