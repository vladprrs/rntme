import { describe, expect, it, mock } from 'bun:test';
import { runStage } from '../src/stage-runner.js';

describe('runStage', () => {
  it('returns ok result without logging', async () => {
    const logs: unknown[] = [];
    const r = await runStage('plan', async () => ({ ok: true as const, value: 42 }), {
      log: (e) => void logs.push(e),
    });
    expect(r).toEqual({ ok: true, value: 42 });
    expect(logs).toEqual([]);
  });

  it('returns the value when stage succeeds (mock variant)', async () => {
    const log = mock();
    const r = await runStage('plan', async () => ({ ok: true as const, value: 42 }), { log });
    expect(r).toEqual({ ok: true, value: 42 });
    expect(log).not.toHaveBeenCalled();
  });

  it('logs an error entry when fn returns failure', async () => {
    const logs: unknown[] = [];
    const r = await runStage(
      'render',
      async () => ({ ok: false as const, errors: [{ code: 'X', message: 'y' }] }),
      { log: (e) => void logs.push(e) },
    );
    expect(r.ok).toBe(false);
    expect(logs).toEqual([{ step: 'render', level: 'error', code: 'X', message: 'y' }]);
  });

  it('logs structured error on Result-Err and returns it (mock variant)', async () => {
    const log = mock();
    const r = await runStage(
      'plan',
      async () => ({ ok: false as const, errors: [{ code: 'X_FAIL', message: 'boom' }] }),
      { log },
    );
    expect(r.ok).toBe(false);
    expect(log).toHaveBeenCalledWith({ step: 'plan', level: 'error', code: 'X_FAIL', message: 'boom' });
  });

  it('logs and re-throws when fn throws', async () => {
    const logs: unknown[] = [];
    let caught: unknown;
    try {
      await runStage('apply', async () => {
        throw new Error('boom');
      }, { log: (e) => void logs.push(e) });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(logs).toEqual([
      { step: 'apply', level: 'error', code: 'DEPLOY_EXECUTOR_UNCAUGHT', message: 'boom' },
    ]);
  });

  it('catches throws, logs uncaught code, re-throws (mock variant)', async () => {
    const log = mock();
    await expect(
      runStage('apply', async () => { throw new Error('kaboom'); }, { log }),
    ).rejects.toThrow('kaboom');
    expect(log).toHaveBeenCalledWith({ step: 'apply', level: 'error', code: 'DEPLOY_EXECUTOR_UNCAUGHT', message: 'kaboom' });
  });
});
