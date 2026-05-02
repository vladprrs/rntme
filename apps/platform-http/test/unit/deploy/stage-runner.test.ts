import { describe, expect, it, vi } from 'vitest';
import { runStage } from '../../../src/deploy/stage-runner.js';

describe('runStage', () => {
  it('returns the value when stage succeeds', async () => {
    const log = vi.fn();
    const r = await runStage('plan', async () => ({ ok: true as const, value: 42 }), { log });
    expect(r).toEqual({ ok: true, value: 42 });
    expect(log).not.toHaveBeenCalled();
  });

  it('logs structured error on Result-Err and returns it', async () => {
    const log = vi.fn();
    const r = await runStage(
      'plan',
      async () => ({ ok: false as const, errors: [{ code: 'X_FAIL', message: 'boom' }] }),
      { log },
    );
    expect(r.ok).toBe(false);
    expect(log).toHaveBeenCalledWith({ step: 'plan', level: 'error', code: 'X_FAIL', message: 'boom' });
  });

  it('catches throws, logs uncaught code, re-throws', async () => {
    const log = vi.fn();
    await expect(
      runStage('apply', async () => { throw new Error('kaboom'); }, { log }),
    ).rejects.toThrow('kaboom');
    expect(log).toHaveBeenCalledWith({ step: 'apply', level: 'error', code: 'DEPLOY_EXECUTOR_UNCAUGHT', message: 'kaboom' });
  });
});
