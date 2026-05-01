import { describe, it, expect } from 'vitest';
import { compileCommand } from '../../../src/command-runtime/compile.js';
import { RAW_ISSUE_PDM as RAW_PDM, RAW_ISSUE_QSM_EMPTY as RAW_QSM } from '../fixtures/issue-pdm.js';

const spec = {
  version: '1.0-rc7' as const,
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    assignIssue: {
      id: 'assignIssue',
      signature: {
        inputs: {
          issueId: { type: 'integer' as const, mode: 'required' as const },
          assigneeId: { type: 'integer' as const, mode: 'required' as const },
        },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit' as const,
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'issueId' },
            transition: 'assign',
            payload: { assigneeId: { $param: 'assigneeId' } },
          },
        },
      ],
    },
  },
};

describe('compileCommand', () => {
  it('returns a CompiledCommand with one EmitPlan and no read-prelude', () => {
    const r = compileCommand(spec, RAW_PDM, RAW_QSM);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.graphId).toBe('assignIssue');
    expect(r.value.aggregate).toBe('Issue');
    expect(r.value.emits).toHaveLength(1);
    expect(r.value.emits[0]!.eventType).toBe('IssueAssign');
    expect(r.value.readPrelude).toBeNull();
    expect(r.value.paramOrder).toEqual(expect.arrayContaining(['issueId', 'assigneeId']));
  });

  it('fails with GRAPH_MIXED_ROLE on rowset output + emit', () => {
    const bad = structuredClone(spec) as typeof spec & {
      graphs: { assignIssue: { signature: { output: { type: string } } } };
    };
    bad.graphs.assignIssue.signature.output.type = 'rowset<X>';
    const r = compileCommand(bad, RAW_PDM, RAW_QSM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.code === 'GRAPH_MIXED_ROLE')).toBe(true);
  });
});
