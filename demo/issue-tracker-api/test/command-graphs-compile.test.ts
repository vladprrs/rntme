import { describe, it, expect } from 'vitest';
import { compileCommand } from '@rntme/graph-ir-compiler';
import { graphSpec, pdm, qsm } from '../src/artifacts.js';

const COMMAND_GRAPH_IDS = [
  'reportIssue',
  'submitIssue',
  'assignIssue',
  'reassignIssue',
  'resolveIssue',
  'reopenIssue',
  'closeIssue',
];

function sliceFor(graphId: string): unknown {
  return { ...graphSpec, graphs: { [graphId]: graphSpec.graphs[graphId] } };
}

describe('command graphs compile', () => {
  it.each(COMMAND_GRAPH_IDS)('%s compiles without errors', (id) => {
    const r = compileCommand(sliceFor(id), pdm, qsm);
    if (!r.ok) {
      throw new Error(`compileCommand(${id}) failed: ${JSON.stringify(r.errors, null, 2)}`);
    }
    expect(r.value.emits).toHaveLength(1);
    expect(r.value.emits[0]!.aggregate).toBe('Issue');
  });
});
