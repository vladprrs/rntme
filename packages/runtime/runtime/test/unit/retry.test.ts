import { describe, it, expect, jest } from 'bun:test';
import { withRetry } from '../../src/plugins/adapter-client/retry.js';
import type { AdapterResult } from '../../src/plugins/adapter-client/types.js';

describe('withRetry', () => {
  it('returns ok on first try when call succeeds', async () => {
    const call = jest.fn(async (): Promise<AdapterResult> => ({ ok: true, value: 1 }));
    const out = await withRetry(call, { attempts: 3, backoffMs: 0, retryOn: 'transient' }, (): void => {});
    expect(out.ok).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('retries transient error up to attempts', async () => {
    let n = 0;
    const call = async (): Promise<AdapterResult> => {
      n++;
      if (n < 3) return { ok: false, errors: [{ code: 'EXTERNAL_MODULE_UNAVAILABLE', message: '', httpStatus: 503 }] };
      return { ok: true, value: n };
    };
    const out = await withRetry(call, { attempts: 3, backoffMs: 0, retryOn: 'transient' }, (): void => {});
    expect(out.ok).toBe(true);
    expect(n).toBe(3);
  });

  it('does not retry terminal errors', async () => {
    const call = jest.fn(async (): Promise<AdapterResult> => ({
      ok: false,
      errors: [{ code: 'EXTERNAL_VENDOR_DOMAIN', message: 'bad', httpStatus: 400 }],
    }));
    const out = await withRetry(call, { attempts: 3, backoffMs: 0, retryOn: 'transient' }, (): void => {});
    expect(out.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('respects retryOn: "never"', async () => {
    const call = jest.fn(async (): Promise<AdapterResult> => ({
      ok: false, errors: [{ code: 'EXTERNAL_MODULE_UNAVAILABLE', message: '', httpStatus: 503 }],
    }));
    const out = await withRetry(call, { attempts: 5, backoffMs: 0, retryOn: 'never' }, (): void => {});
    expect(out.ok).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });
});
