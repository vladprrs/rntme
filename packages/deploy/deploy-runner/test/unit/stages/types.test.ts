import { describe, expect, it } from 'bun:test';
import type {
  ComposeStageInput,
  ComposeStageOutput,
  ProvisionStageInput,
  ProvisionStageOutput,
  PlanStageInput,
  PlanStageOutput,
  RenderStageInput,
  RenderStageOutput,
  ApplyStageInput,
  ApplyStageOutput,
  VerifyStageInput,
  VerifyStageOutput,
} from '../../../src/stages/types.js';

describe('stage I/O types', () => {
  it('compose output is the input to provision and plan', () => {
    const compose: ComposeStageOutput = {} as ComposeStageOutput;
    const _provision: ProvisionStageInput['composed'] = compose.composed;
    const _plan: PlanStageInput['composed'] = compose.composed;
    expect(true).toBe(true);
  });

  it('provision output threads into plan and render inputs', () => {
    const provision: ProvisionStageOutput = {} as ProvisionStageOutput;
    const _plan: PlanStageInput['provision'] = provision;
    const _render: RenderStageInput['provisioned'] = provision.provisioned;
    expect(true).toBe(true);
  });

  it('plan output threads into render input', () => {
    const plan: PlanStageOutput = {} as PlanStageOutput;
    const _render: RenderStageInput['plan'] = plan.plan;
    expect(true).toBe(true);
  });

  it('render output threads into apply input', () => {
    const render: RenderStageOutput = {} as RenderStageOutput;
    const _apply: ApplyStageInput['rendered'] = render.rendered;
    expect(true).toBe(true);
  });

  it('apply output threads into verify input', () => {
    const apply: ApplyStageOutput = {} as ApplyStageOutput;
    const _verify: VerifyStageInput['applied'] = apply.applied;
    expect(true).toBe(true);
  });
});
