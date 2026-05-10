import { describe, expect, it, mock } from 'bun:test';
import { runStage } from '@rntme/deploy-runner';

describe('runStage', () => {
  it('returns the value when stage succeeds', async () => {
    const log = mock();
    const r = await runStage('plan', async () => ({ ok: true as const, value: 42 }), { log });
    expect(r).toEqual({ ok: true, value: 42 });
    expect(log).not.toHaveBeenCalled();
  });

  it('logs structured error on Result-Err and returns it', async () => {
    const log = mock();
    const r = await runStage(
      'plan',
      async () => ({ ok: false as const, errors: [{ code: 'X_FAIL', message: 'boom' }] }),
      { log },
    );
    expect(r.ok).toBe(false);
    expect(log).toHaveBeenCalledWith({ step: 'plan', level: 'error', code: 'X_FAIL', message: 'boom' });
  });

  it('catches throws, logs uncaught code, re-throws', async () => {
    const log = mock();
    await expect(
      runStage('apply', async () => { throw new Error('kaboom'); }, { log }),
    ).rejects.toThrow('kaboom');
    expect(log).toHaveBeenCalledWith({ step: 'apply', level: 'error', code: 'DEPLOY_EXECUTOR_UNCAUGHT', message: 'kaboom' });
  });
});
