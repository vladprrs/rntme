import { describe, expect, it } from 'bun:test';
import type {
  NormalizedDeployTarget,
  ResolvedTargetSecrets,
  DeploymentHooks,
  RunDeploymentInputs,
  TerminalResult,
  StageName,
  SanitizedLogLine,
  StageEvidence,
} from '../src/index.js';

describe('public types', () => {
  it('NormalizedDeployTarget discriminates by kind', () => {
    const t: NormalizedDeployTarget = {
      id: 'tgt-1',
      slug: 'preview',
      kind: 'dokploy',
      displayName: 'Preview',
      dokployUrl: 'https://dokploy.example.com',
      dokployProjectId: 'proj-1',
    };
    expect(t.kind).toBe('dokploy');
  });

  it('TerminalResult union is exhaustive', () => {
    const ok: TerminalResult = { ok: true, kind: 'succeeded' };
    const err: TerminalResult = {
      ok: false,
      kind: 'failed',
      errorCode: 'X',
      errorMessage: 'y',
    };
    expect(ok.ok).toBe(true);
    expect(err.ok).toBe(false);
  });

  it('StageName enumerates known stages', () => {
    const stages: StageName[] = ['plan', 'provision', 'render', 'apply', 'verify'];
    expect(stages.length).toBe(5);
  });

  it('DeploymentHooks fields are optional', () => {
    const hooks: DeploymentHooks = {};
    expect(hooks).toEqual({});
  });

  it('RunDeploymentInputs requires the documented fields', () => {
    // Compile-time only; presence of the fields is checked by the type system.
    const _shape: keyof RunDeploymentInputs = 'composedBlueprint';
    expect(_shape).toBe('composedBlueprint');
  });

  it('SanitizedLogLine has level/step/message', () => {
    const l: SanitizedLogLine = { level: 'info', step: 'plan', message: 'ok' };
    expect(l.level).toBe('info');
  });

  it('StageEvidence is keyed by StageName', () => {
    const e: StageEvidence = { stage: 'plan', durationMs: 0 };
    expect(e.stage).toBe('plan');
  });

  it('ResolvedTargetSecrets has apiToken + extras', () => {
    const s: ResolvedTargetSecrets = { apiToken: 'tok', extras: {} };
    expect(s.apiToken).toBe('tok');
  });
});
