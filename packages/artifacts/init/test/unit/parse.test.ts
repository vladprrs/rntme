import { describe, expect, it } from 'bun:test';
import { parseInitArtifact } from '../../src/index.js';

const valid = {
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

describe('parseInitArtifact', () => {
  it('parses a valid object', () => {
    const result = parseInitArtifact(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.steps[0]?.id).toBe('notes.welcome');
  });

  it('parses a JSON string', () => {
    const result = parseInitArtifact(JSON.stringify(valid));
    expect(result.ok).toBe(true);
  });

  it('rejects unknown fields', () => {
    const result = parseInitArtifact({ ...valid, extra: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('INIT_PARSE_SCHEMA_VIOLATION');
      expect(result.errors[0]?.path).toBeDefined();
    }
  });

  it('rejects unsupported initVersion', () => {
    const result = parseInitArtifact({ ...valid, initVersion: 2 });
    expect(result.ok).toBe(false);
  });
});
