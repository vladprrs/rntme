import { describe, expect, it } from 'vitest';

describe.skipIf(process.env.INTEGRATION !== '1')('integration: MinIO + local registry', () => {
  it('is gated until Docker-backed integration is enabled', () => {
    expect(process.env.INTEGRATION).toBe('1');
  });
});
