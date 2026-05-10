import { describe, expect, it, mock } from 'bun:test';
import type { runDeployment } from '@rntme/deploy-runner';
import { runDirectDeployment } from '../../../src/deploy-engine/run.js';

type RunDeploymentParams = Parameters<typeof runDeployment>[0];

describe('runDirectDeployment hooks', () => {
  it('writes structured stage events to the provided stdout sink', async () => {
    const lines: string[] = [];
    const orchestrator = mock(async (inputs: RunDeploymentParams) => {
      await inputs.hooks?.onLog?.({ level: 'info', step: 'plan', message: 'planning' });
      await inputs.hooks?.onStageBegin?.('plan');
      await inputs.hooks?.onStageComplete?.('plan', { stage: 'plan', durationMs: 12 });
      await inputs.hooks?.onTerminal?.({ ok: true, kind: 'succeeded' });
      return { ok: true, kind: 'succeeded' as const };
    });
    const result = await runDirectDeployment({
      composedBlueprint: { name: 'demo' } as never,
      bundleDir: '/tmp/none',
      target: { slug: 'preview', kind: 'dokploy', dokployUrl: 'http://x' } as never,
      resolvedTargetSecrets: { apiToken: 'tok', extras: {} },
      orgSlug: 'direct',
      configOverrides: {},
      priorProvisionOutputs: {},
      resolveProvisioner: (() => undefined) as never,
      dokployClientFactory: (() => ({})) as never,
      stdout: { write: (s: string) => { lines.push(s); return true; } },
      orchestrator: orchestrator as never,
    });
    expect(result.ok).toBe(true);
    expect(lines.some((l) => l.includes('plan'))).toBe(true);
    expect(lines.some((l) => l.includes('planning'))).toBe(true);
  });

  it('writes JSONL evidence when logFile is provided', async () => {
    const written: string[] = [];
    const result = await runDirectDeployment({
      composedBlueprint: { name: 'demo' } as never,
      bundleDir: '/tmp/none',
      target: { slug: 'preview', kind: 'dokploy', dokployUrl: 'http://x' } as never,
      resolvedTargetSecrets: { apiToken: 'tok', extras: {} },
      orgSlug: 'direct',
      configOverrides: {},
      priorProvisionOutputs: {},
      resolveProvisioner: (() => undefined) as never,
      dokployClientFactory: (() => ({})) as never,
      stdout: { write: () => true },
      logFileWriter: (line: string) => { written.push(line); },
      orchestrator: (async (inputs: RunDeploymentParams) => {
        await inputs.hooks?.onLog?.({ level: 'info', step: 'plan', message: 'hi' });
        await inputs.hooks?.onTerminal?.({ ok: true, kind: 'succeeded' });
        return { ok: true, kind: 'succeeded' as const };
      }) as never,
    });
    expect(result.ok).toBe(true);
    expect(written.some((l) => JSON.parse(l).message === 'hi')).toBe(true);
  });
});
