import { rm } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'bun:test';
import { runDeployment } from '../src/run-deployment.js';
import type { SanitizedLogLine, StageName, TerminalResult } from '../src/index.js';
import {
  makeRunDeploymentInputsFromExecutorFixture,
  takeTrackedDirs,
} from './fixtures/executor-bridge.js';

afterEach(async () => {
  for (const dir of takeTrackedDirs()) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe('runDeployment', () => {
  it('emits stage hooks in order compose → provision → plan → render → apply → verify', async () => {
    // The fixture has no provisioner modules so the provision stage runs
    // as a no-op, but it still emits its begin/complete hooks.
    const stages: StageName[] = [];
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: { onStageBegin: (s) => void stages.push(s) },
    });
    const result = await runDeployment(inputs);
    expect(result.ok).toBe(true);
    expect(stages).toEqual(['compose', 'provision', 'plan', 'render', 'apply', 'verify']);
  });

  it('emits onProvisionResult → onApplyResult → onVerifyResult → onTerminal in order', async () => {
    const calls: string[] = [];
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: {
        onProvisionResult: () => void calls.push('provision'),
        onApplyResult: () => void calls.push('apply'),
        onVerifyResult: () => void calls.push('verify'),
        onTerminal: (r) => {
          calls.push('terminal');
          expect(r).toEqual({ ok: true, kind: 'succeeded' });
        },
      },
    });
    const result = await runDeployment(inputs);
    expect(result).toEqual({ ok: true, kind: 'succeeded' });
    expect(calls).toEqual(['provision', 'apply', 'verify', 'terminal']);
  });

  it('emits onTerminal exactly once with kind succeeded on success', async () => {
    const calls: TerminalResult[] = [];
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: { onTerminal: (r) => void calls.push(r) },
    });
    await runDeployment(inputs);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ ok: true, kind: 'succeeded' });
  });

  it('redacts secrets in logs', async () => {
    const lines: SanitizedLogLine[] = [];
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: { onLog: (l) => void lines.push(l) },
      seedDokployApiToken: 'shibboleth-token',
    });
    await runDeployment(inputs);
    const concatenated = lines.map((l) => l.message).join('\n');
    expect(concatenated).not.toContain('shibboleth-token');
  });

  it('emits onApplyResult before terminal success', async () => {
    let applyResultEmitted = false;
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: {
        onApplyResult: () => {
          applyResultEmitted = true;
        },
        onTerminal: (r) => {
          expect(applyResultEmitted).toBe(true);
          expect(r.ok).toBe(true);
        },
      },
    });
    const result = await runDeployment(inputs);
    expect(result.ok).toBe(true);
    expect(applyResultEmitted).toBe(true);
  });

  it('returns the same TerminalResult that was emitted via onTerminal', async () => {
    let emitted: TerminalResult | undefined;
    const inputs = makeRunDeploymentInputsFromExecutorFixture({
      hooks: { onTerminal: (r) => void (emitted = r) },
    });
    const returned = await runDeployment(inputs);
    expect(returned).toEqual(emitted as TerminalResult);
  });
});
