import { describe, expect, it } from 'vitest';
import { validateUuid } from '../../src/util/uuid.js';

describe('validateUuid', () => {
  it('accepts a v4 UUID', () => {
    const r = validateUuid('5db540dd-3706-4b74-b7b6-27ca43f9b458', 'deployment-id');
    expect(r.ok).toBe(true);
  });

  it('rejects a truncated id with CLI_VALIDATE_NOT_UUID', () => {
    const r = validateUuid('5db540dd-37', 'deployment-id');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('CLI_VALIDATE_NOT_UUID');
  });
});
