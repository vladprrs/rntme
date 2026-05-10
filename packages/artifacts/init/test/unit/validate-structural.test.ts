import { describe, expect, it } from 'bun:test';
import { parseInitArtifact, validateInitStructural } from '../../src/index.js';

function parsed(raw: unknown) {
  const result = parseInitArtifact(raw);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

const base = {
  initVersion: 1,
  process: {
    kind: 'bpmn',
    definition: 'project-initialized.bpmn',
    processId: 'ProjectInitialized',
  },
  steps: [
    {
      id: 'notes.welcome',
      type: 'init',
      provider: 'seed-events',
      targetService: 'app',
      mode: 'lifecycle',
      input: { path: 'files/notes.seed.json' },
      dependsOn: [],
    },
  ],
};

describe('validateInitStructural', () => {
  it('accepts a valid artifact', () => {
    expect(validateInitStructural(parsed(base)).ok).toBe(true);
  });

  it('rejects unsafe process definition paths', () => {
    const result = validateInitStructural(parsed({
      ...base,
      process: { ...base.process, definition: '../workflow.bpmn' },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_STRUCT_PROCESS_DEFINITION_PATH_INVALID');
  });

  it('rejects duplicate step ids', () => {
    const result = validateInitStructural(parsed({
      ...base,
      steps: [base.steps[0], base.steps[0]],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_STRUCT_STEP_ID_DUPLICATE');
  });

  it('rejects unsupported providers and modes', () => {
    const result = validateInitStructural(parsed({
      ...base,
      steps: [{ ...base.steps[0], provider: 'raw-sql', mode: 'boot' }],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.code)).toEqual(expect.arrayContaining([
        'INIT_STRUCT_STEP_PROVIDER_UNSUPPORTED',
        'INIT_STRUCT_STEP_MODE_UNSUPPORTED',
      ]));
    }
  });

  it('rejects unsafe seed input paths', () => {
    const result = validateInitStructural(parsed({
      ...base,
      steps: [{ ...base.steps[0], input: { path: 'https://example.test/seed.json' } }],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_STRUCT_STEP_INPUT_PATH_INVALID');
  });

  it('rejects missing and self dependencies', () => {
    const result = validateInitStructural(parsed({
      ...base,
      steps: [{ ...base.steps[0], dependsOn: ['notes.welcome', 'missing.step'] }],
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.code)).toEqual(expect.arrayContaining([
        'INIT_STRUCT_STEP_DEPENDS_ON_SELF',
        'INIT_STRUCT_STEP_DEPENDS_ON_UNKNOWN',
      ]));
    }
  });
});
