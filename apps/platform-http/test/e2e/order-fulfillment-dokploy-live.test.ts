import { describe, expect, it } from 'vitest';
import { readLiveDokployEnv } from './live-dokploy-env.js';

const live = readLiveDokployEnv();

describe.skipIf(!live.enabled)(`live Dokploy order fulfillment${live.enabled ? '' : ` (${live.reason})`}`, () => {
  it('has live env configured', () => {
    expect(live.enabled).toBe(true);
  });
});
