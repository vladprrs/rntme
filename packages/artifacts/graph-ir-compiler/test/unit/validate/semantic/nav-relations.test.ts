/**
 * Tests for checkNavRelations: semantic validator that walks dot-nav paths
 * against QSM.relations and emits NAV_NOT_ALLOWED / NAV_FAN_OUT_NOT_ALLOWED
 * via the Result pipeline instead of throwing raw errors.
 */
import { describe, it, expect } from 'bun:test';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { validateQsm } from '@rntme/qsm';
import { validateSemantic } from '../../../../src/validate/semantic/index.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import { compile } from '../../../../src/index.js';
import type { AuthoringSpecOutput } from '../../../../src/parse/schema.js';

// ---------------------------------------------------------------------------
// Shared base PDM: Issue → Sprint → Project (for multi-hop tests)
// All entities have state machines so entity-mirror projections are allowed.
// ---------------------------------------------------------------------------
const baseRawPdm = {
  entities: {
    Issue: {
      ownerService: 'issue-tracker',
      kind: 'owned',
      table: 'issues',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        ownerId: { type: 'integer', nullable: false, column: 'owner_id' },
        sprintId: { type: 'integer', nullable: false, column: 'sprint_id' },
        title: { type: 'string', nullable: false, column: 'title' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {
        owner: { to: 'User', cardinality: 'one', localKey: 'ownerId', foreignKey: 'id' },
        sprint: { to: 'Sprint', cardinality: 'one', localKey: 'sprintId', foreignKey: 'id' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['open'],
        transitions: { create: { from: null, to: 'open', affects: ['title', 'ownerId'] } },
      },
    },
    User: {
      ownerService: 'issue-tracker',
      kind: 'owned',
      table: 'users',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        name: { type: 'string', nullable: false, column: 'name' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {},
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['active'],
        transitions: { create: { from: null, to: 'active', affects: ['name'] } },
      },
    },
    Sprint: {
      ownerService: 'issue-tracker',
      kind: 'owned',
      table: 'sprints',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        projectId: { type: 'integer', nullable: false, column: 'project_id' },
        name: { type: 'string', nullable: false, column: 'name' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {
        project: { to: 'Project', cardinality: 'one', localKey: 'projectId', foreignKey: 'id' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['active'],
        transitions: { create: { from: null, to: 'active', affects: ['name'] } },
      },
    },
    Project: {
      ownerService: 'issue-tracker',
      kind: 'owned',
      table: 'projects',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        name: { type: 'string', nullable: false, column: 'name' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {},
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['active'],
        transitions: { create: { from: null, to: 'active', affects: ['name'] } },
      },
    },
  },
};

// PDM variant that includes a many-cardinality relation for fan-out tests.
// Comment uses issueId as its primary key (composite key in real life, but
// in this test we give it a single-key PK = issueId to satisfy QSM validators).
const fanOutRawPdm = {
  entities: {
    ...baseRawPdm.entities,
    Comment: {
      ownerService: 'issue-tracker',
      kind: 'owned',
      table: 'comments',
      fields: {
        issueId: { type: 'integer', nullable: false, column: 'issue_id' },
        body: { type: 'string', nullable: false, column: 'body' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      // issueId is the key (test-simplification: one comment per issue for fixture validity)
      relations: {},
      keys: ['issueId'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['active'],
        transitions: { create: { from: null, to: 'active', affects: ['body'] } },
      },
    },
    Issue: {
      ...baseRawPdm.entities.Issue,
      relations: {
        ...baseRawPdm.entities.Issue.relations,
        // many-cardinality: Issue.id → Comment.issueId (where issueId is Comment's key)
        comments: { to: 'Comment', cardinality: 'many', localKey: 'id', foreignKey: 'issueId' },
      },
    },
  },
};

function makePdm(raw = baseRawPdm) {
  const parsed = parsePdm(raw);
  if (!parsed.ok) throw new Error(`parsePdm failed: ${JSON.stringify(parsed.errors)}`);
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error(`validatePdm failed: ${JSON.stringify(validated.errors)}`);
  return validated.value;
}

// ---------------------------------------------------------------------------
// Helper: build a spec with a map node referencing a given field path
// ---------------------------------------------------------------------------
function makeSpec(fieldPath: string, shapeName = 'IssueOut'): AuthoringSpecOutput {
  return {
    version: '1.0-rc7',
    pdmRef: 'x',
    qsmRef: 'y',
    shapes: {
      [shapeName]: { fields: { result: { type: 'string', nullable: true } } },
    },
    graphs: {
      g: {
        id: 'g',
        signature: { inputs: {}, output: { type: `rowset<${shapeName}>`, from: 'proj' } },
        nodes: [
          { id: 'items', type: 'findMany', config: { source: { entity: 'Issue' } } },
          {
            id: 'proj',
            type: 'map',
            config: {
              input: 'items',
              into: shapeName,
              fields: { result: fieldPath },
            },
          },
        ],
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Test 1: NAV_NOT_ALLOWED — undeclared hop
// IssueView exists but QSM.relations has NO entry for IssueView.owner.
// ---------------------------------------------------------------------------
describe('semantic validate — NAV_NOT_ALLOWED / NAV_FAN_OUT_NOT_ALLOWED', () => {
  it('emits NAV_NOT_ALLOWED when a hop is not declared in QSM.relations', () => {
    const pdm = makePdm();
    // IssueView exists (entity-mirror for Issue) but NO relations declared
    const rawQsm = {
      projections: {
        IssueView: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'ownerId', 'title'],
        },
      },
      relations: {}, // IssueView.owner intentionally absent
    };
    const qsmR = validateQsm(rawQsm, createPdmResolver(pdm));
    if (!qsmR.ok) throw new Error(`validateQsm failed: ${JSON.stringify(qsmR.errors)}`);
    const qsm = qsmR.value;

    const spec = makeSpec('issue.owner.name');
    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).toContain('NAV_NOT_ALLOWED');
      const e = res.errors.find((x) => x.code === 'NAV_NOT_ALLOWED')!;
      expect(e.message).toContain('IssueView.owner');
      expect(e.location?.path).toBe('issue.owner.name');
    }
  });

  // ---------------------------------------------------------------------------
  // Test 2: NAV_FAN_OUT_NOT_ALLOWED — many-cardinality hop
  // IssueView.comments exists in QSM but cardinality is 'many'.
  // ---------------------------------------------------------------------------
  it('emits NAV_FAN_OUT_NOT_ALLOWED when hop has cardinality "many"', () => {
    const pdm = makePdm(fanOutRawPdm);
    const rawQsm = {
      projections: {
        IssueView: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'ownerId', 'title'],
        },
        CommentMirror: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Comment' },
          keys: ['issueId'],
          grain: ['issueId'],
          exposed: ['issueId', 'body'],
        },
      },
      relations: {
        'IssueView.comments': {
          to: 'CommentMirror',
          localKey: 'id',
          foreignKey: 'issueId',
          cardinality: 'many' as const,
        },
      },
    };
    const qsmR = validateQsm(rawQsm, createPdmResolver(pdm));
    if (!qsmR.ok) throw new Error(`validateQsm failed: ${JSON.stringify(qsmR.errors)}`);
    const qsm = qsmR.value;

    const spec = makeSpec('issue.comments.body');
    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).toContain('NAV_FAN_OUT_NOT_ALLOWED');
      const e = res.errors.find((x) => x.code === 'NAV_FAN_OUT_NOT_ALLOWED')!;
      expect(e.message).toContain('IssueView.comments');
      expect(e.location?.path).toBe('issue.comments.body');
    }
  });

  // ---------------------------------------------------------------------------
  // Test 3: Valid one-hop — no NAV errors
  // IssueView.owner exists with cardinality 'one'.
  // ---------------------------------------------------------------------------
  it('does NOT emit NAV errors for a valid one-hop (cardinality "one")', () => {
    const pdm = makePdm();
    const rawQsm = {
      projections: {
        IssueView: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'ownerId', 'title'],
        },
        UserMirror: {
          backing: 'entity-mirror' as const,
          source: { entity: 'User' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'name'],
        },
      },
      relations: {
        'IssueView.owner': {
          to: 'UserMirror',
          localKey: 'ownerId',
          foreignKey: 'id',
          cardinality: 'one' as const,
        },
      },
    };
    const qsmR = validateQsm(rawQsm, createPdmResolver(pdm));
    if (!qsmR.ok) throw new Error(`validateQsm failed: ${JSON.stringify(qsmR.errors)}`);
    const qsm = qsmR.value;

    const spec = makeSpec('issue.owner.name');
    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);

    // Other validators may flag other issues; specifically no NAV errors expected
    if (!res.ok) {
      const navErrors = res.errors.filter(
        (e) => e.code === 'NAV_NOT_ALLOWED' || e.code === 'NAV_FAN_OUT_NOT_ALLOWED',
      );
      expect(navErrors).toHaveLength(0);
    }
  });

  // ---------------------------------------------------------------------------
  // Test 4: Multi-hop pass-through — no NAV errors
  // issue.sprint.project.name: IssueView.sprint (one) → SprintMirror.project (one)
  // ---------------------------------------------------------------------------
  it('does NOT emit NAV errors for a valid two-hop path', () => {
    const pdm = makePdm();
    const rawQsm = {
      projections: {
        IssueView: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'sprintId', 'title'],
        },
        SprintMirror: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Sprint' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'projectId', 'name'],
        },
        ProjMirror: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Project' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'name'],
        },
      },
      relations: {
        'IssueView.sprint': {
          to: 'SprintMirror',
          localKey: 'sprintId',
          foreignKey: 'id',
          cardinality: 'one' as const,
        },
        'SprintMirror.project': {
          to: 'ProjMirror',
          localKey: 'projectId',
          foreignKey: 'id',
          cardinality: 'one' as const,
        },
      },
    };
    const qsmR = validateQsm(rawQsm, createPdmResolver(pdm));
    if (!qsmR.ok) throw new Error(`validateQsm failed: ${JSON.stringify(qsmR.errors)}`);
    const qsm = qsmR.value;

    // Four-part path: issue.sprint.project.name
    const spec: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        IssueOut4: { fields: { result: { type: 'string', nullable: true } } },
      },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<IssueOut4>', from: 'proj' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'Issue' } } },
            {
              id: 'proj',
              type: 'map',
              config: {
                input: 'items',
                into: 'IssueOut4',
                fields: { result: 'issue.sprint.project.name' },
              },
            },
          ],
        },
      },
    };

    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);

    if (!res.ok) {
      const navErrors = res.errors.filter(
        (e) => e.code === 'NAV_NOT_ALLOWED' || e.code === 'NAV_FAN_OUT_NOT_ALLOWED',
      );
      expect(navErrors).toHaveLength(0);
    }
  });

  // ---------------------------------------------------------------------------
  // Test 5: Multi-hop with missing MIDDLE hop
  // IssueView.sprint is declared (one) but SprintMirror.project is NOT.
  // Should emit NAV_NOT_ALLOWED for SprintMirror.project, not IssueView.sprint.
  // ---------------------------------------------------------------------------
  it('emits NAV_NOT_ALLOWED for missing middle hop, not the first valid hop', () => {
    const pdm = makePdm();
    const rawQsm = {
      projections: {
        IssueView: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'sprintId', 'title'],
        },
        SprintMirror: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Sprint' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'projectId', 'name'],
        },
        ProjMirror: {
          backing: 'entity-mirror' as const,
          source: { entity: 'Project' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'name'],
        },
      },
      relations: {
        'IssueView.sprint': {
          to: 'SprintMirror',
          localKey: 'sprintId',
          foreignKey: 'id',
          cardinality: 'one' as const,
        },
        // SprintMirror.project intentionally absent
      },
    };
    const qsmR = validateQsm(rawQsm, createPdmResolver(pdm));
    if (!qsmR.ok) throw new Error(`validateQsm failed: ${JSON.stringify(qsmR.errors)}`);
    const qsm = qsmR.value;

    const spec: AuthoringSpecOutput = {
      version: '1.0-rc7',
      pdmRef: 'x',
      qsmRef: 'y',
      shapes: {
        IssueOut5: { fields: { result: { type: 'string', nullable: true } } },
      },
      graphs: {
        g: {
          id: 'g',
          signature: { inputs: {}, output: { type: 'rowset<IssueOut5>', from: 'proj' } },
          nodes: [
            { id: 'items', type: 'findMany', config: { source: { entity: 'Issue' } } },
            {
              id: 'proj',
              type: 'map',
              config: {
                input: 'items',
                into: 'IssueOut5',
                fields: { result: 'issue.sprint.project.name' },
              },
            },
          ],
        },
      },
    };

    const { graphs } = normalize(spec);
    const res = validateSemantic(graphs.g!, pdm, qsm, spec.shapes);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.map((e) => e.code)).toContain('NAV_NOT_ALLOWED');
      const e = res.errors.find((x) => x.code === 'NAV_NOT_ALLOWED')!;
      // Error is on SprintMirror.project (the missing middle hop)
      expect(e.message).toContain('SprintMirror.project');
      // NOT on IssueView.sprint (which IS declared)
      expect(e.message).not.toContain('IssueView.sprint');
    }
  });

  // ---------------------------------------------------------------------------
  // Test 6: End-to-end via compile() — must return structured Result, NOT throw
  // ---------------------------------------------------------------------------
  it('compile() returns structured { ok: false } Result instead of throwing for NAV_NOT_ALLOWED', () => {
    // Raw PDM and QSM as plain objects (compile() takes raw unknown inputs)
    const rawQsm = {
      projections: {
        IssueView: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'ownerId', 'title'],
        },
        UserMirror: {
          backing: 'entity-mirror',
          source: { entity: 'User' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'name'],
        },
      },
      // IssueView.owner intentionally absent — triggers NAV_NOT_ALLOWED
      relations: {},
    };

    const spec = makeSpec('issue.owner.name');

    // compile() MUST NOT throw — contract violation is the bug we're fixing
    let result: ReturnType<typeof compile>;
    expect(() => {
      result = compile(spec, baseRawPdm, rawQsm);
    }).not.toThrow();

    result = compile(spec, baseRawPdm, rawQsm);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.code)).toContain('NAV_NOT_ALLOWED');
    }
  });
});
