import { describe, it, expect } from 'bun:test';
import { deriveOperationRunId } from '../../src/idempotency/derive-keys.js';

describe('idempotency key derivation', () => {
  it('deriveOperationRunId is deterministic for same (operationName, clientKey)', () => {
    const a = deriveOperationRunId('createOrder', 'abc');
    const b = deriveOperationRunId('createOrder', 'abc');
    expect(a).toBe(b);
  });
  it('deriveOperationRunId differs when operationName differs', () => {
    expect(deriveOperationRunId('a', 'k')).not.toBe(deriveOperationRunId('b', 'k'));
  });
});
