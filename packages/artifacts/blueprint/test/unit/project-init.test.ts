import { describe, expect, it } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPdmResolver, deriveEventTypes, validatePdm } from '@rntme/pdm';
import { loadProjectInit } from '../../src/compose/project-init.js';

function writeJson(root: string, rel: string, value: unknown): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function writeText(root: string, rel: string, value: string): void {
  const path = join(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function pdm() {
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
    },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.value;
}

function writeValidInit(root: string): void {
  writeText(root, 'init/project-initialized.bpmn', '<definitions />');
  writeJson(root, 'init/files/notes.seed.json', {
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
  });
  writeJson(root, 'init/init.json', {
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
      },
    ],
  });
}

describe('loadProjectInit', () => {
  it('returns null when init/init.json is absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    const model = pdm();
    const result = loadProjectInit({
      rootDir: root,
      services: ['app'],
      pdm: createPdmResolver(model),
      eventsByService: { app: deriveEventTypes(model) },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it('loads a valid project init artifact', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeValidInit(root);
    const model = pdm();
    const result = loadProjectInit({
      rootDir: root,
      services: ['app'],
      pdm: createPdmResolver(model),
      eventsByService: { app: deriveEventTypes(model) },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value?.steps[0]?.id).toBe('notes.welcome');
  });

  it('wraps init validation failures as BLUEPRINT_INIT_INVALID', () => {
    const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
    writeValidInit(root);
    writeJson(root, 'init/init.json', {
      initVersion: 1,
      process: { kind: 'bpmn', definition: '../bad.bpmn', processId: 'ProjectInitialized' },
      steps: [],
    });
    const model = pdm();
    const result = loadProjectInit({
      rootDir: root,
      services: ['app'],
      pdm: createPdmResolver(model),
      eventsByService: { app: deriveEventTypes(model) },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('BLUEPRINT_INIT_INVALID');
  });
});
