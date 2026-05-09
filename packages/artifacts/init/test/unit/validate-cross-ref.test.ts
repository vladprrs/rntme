import { describe, expect, it } from 'vitest';
import { createPdmResolver, deriveEventTypes, validatePdm } from '@rntme/pdm';
import {
  parseInitArtifact,
  validateInitCrossRef,
  validateInitStructural,
  type InitCrossRefContext,
} from '../../src/index.js';

function projectPdm() {
  const result = validatePdm({
    entities: {
      Note: {
        ownerService: 'app',
        kind: 'owned',
        table: 'notes',
        fields: {
          id: { type: 'string', nullable: false, column: 'id' },
          status: { type: 'string', nullable: false, column: 'status' },
          body: { type: 'string', nullable: false, column: 'body' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['active'],
          transitions: {
            create: { from: null, to: 'active', affects: ['body'] },
          },
        },
      },
      Invoice: {
        ownerService: 'billing',
        kind: 'owned',
        table: 'invoices',
        fields: {
          id: { type: 'string', nullable: false, column: 'id' },
          status: { type: 'string', nullable: false, column: 'status' },
        },
        keys: ['id'],
        stateMachine: {
          stateField: 'status',
          initial: null,
          states: ['issued'],
          transitions: {
            issue: { from: null, to: 'issued', affects: [] },
          },
        },
      },
    },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function artifact(stepOverrides: Record<string, unknown> = {}) {
  const parsed = parseInitArtifact({
    initVersion: 1,
    process: { kind: 'bpmn', definition: 'project-initialized.bpmn', processId: 'ProjectInitialized' },
    steps: [
      {
        id: 'notes.welcome',
        type: 'init',
        provider: 'seed-events',
        targetService: 'app',
        mode: 'lifecycle',
        input: { path: 'files/notes.seed.json' },
        dependsOn: [],
        ...stepOverrides,
      },
    ],
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const structural = validateInitStructural(parsed.value);
  if (!structural.ok) throw new Error(JSON.stringify(structural.errors));
  return structural.value;
}

function ctx(seed: unknown, overrides: Partial<InitCrossRefContext> = {}): InitCrossRefContext {
  const pdm = projectPdm();
  return {
    services: ['app', 'billing'],
    pdm: createPdmResolver(pdm),
    eventsByService: {
      app: deriveEventTypes(pdm).filter((e) => e.aggregateType === 'Note'),
      billing: deriveEventTypes(pdm).filter((e) => e.aggregateType === 'Invoice'),
    },
    fileExists: (path) => path === 'project-initialized.bpmn' || path === 'files/notes.seed.json',
    readJson: (path) => path === 'files/notes.seed.json' ? seed : null,
    ...overrides,
  };
}

const validSeed = {
  seedVersion: 1,
  events: [
    {
      id: 'seed:Note:welcome:v1',
      subject: 'Note-welcome',
      rntAggregateType: 'Note',
      rntAggregateId: 'welcome',
      rntVersion: 1,
      eventType: 'NoteCreate',
      data: { body: 'Welcome' },
      time: '2026-05-08T00:00:00.000Z',
    },
  ],
};

describe('validateInitCrossRef', () => {
  it('accepts a valid seed-events step', () => {
    const result = validateInitCrossRef(artifact(), ctx(validSeed));
    expect(result.ok).toBe(true);
  });

  it('rejects missing process definitions', () => {
    const result = validateInitCrossRef(artifact(), ctx(validSeed, { fileExists: (path) => path !== 'project-initialized.bpmn' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_XREF_PROCESS_DEFINITION_MISSING');
  });

  it('rejects unknown target services', () => {
    const result = validateInitCrossRef(artifact({ targetService: 'missing' }), ctx(validSeed));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_XREF_TARGET_SERVICE_UNKNOWN');
  });

  it('rejects missing seed input files', () => {
    const result = validateInitCrossRef(artifact(), ctx(validSeed, { fileExists: (path) => path === 'project-initialized.bpmn' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_XREF_STEP_INPUT_MISSING');
  });

  it('rejects seed events outside the target service owner scope', () => {
    const badSeed = {
      seedVersion: 1,
      events: [
        {
          id: 'seed:Invoice:1:v1',
          subject: 'Invoice-1',
          rntAggregateType: 'Invoice',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'InvoiceIssue',
          data: {},
          time: '2026-05-08T00:00:00.000Z',
        },
      ],
    };
    const result = validateInitCrossRef(artifact(), ctx(badSeed));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('INIT_XREF_SEED_INVALID');
  });
});
