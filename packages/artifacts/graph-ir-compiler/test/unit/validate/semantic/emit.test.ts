import { describe, it, expect } from 'bun:test';
import { checkEmit } from '../../../../src/validate/semantic/emit.js';
import { normalize } from '../../../../src/canonical/normalize.js';
import { parseAuthoringSpec } from '../../../../src/parse/parse.js';
import { ISSUE_PDM as PDM, ISSUE_QSM_EMPTY as QSM } from '../../fixtures/issue-pdm.js';

function graphFor(
  config: Record<string, unknown>,
  inputs: Record<string, unknown> = {
    id: { type: 'integer', mode: 'required' },
    assigneeId: { type: 'integer', mode: 'required' },
  },
) {
  const p = parseAuthoringSpec({
    version: '1.0-rc7',
    pdmRef: 'p',
    qsmRef: 'q',
    shapes: {},
    graphs: {
      g: {
        id: 'g',
        signature: { inputs, output: { type: 'row<CommandResult>', from: 'e' } },
        nodes: [{ id: 'e', type: 'emit', config }],
      },
    },
  });
  if (!p.ok) throw new Error('parse failed');
  return normalize(p.value).graphs.g!;
}

describe('checkEmit', () => {
  it('passes for a valid emit', () => {
    const g = graphFor({
      aggregate: 'Issue',
      aggregateId: { $param: 'id' },
      transition: 'assign',
      payload: { assigneeId: { $param: 'assigneeId' } },
    });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs).toHaveLength(0);
  });

  it('CMD_UNKNOWN_AGGREGATE when aggregate not in PDM', () => {
    const g = graphFor({
      aggregate: 'Ghost',
      aggregateId: { $param: 'id' },
      transition: 'assign',
      payload: {},
    });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs[0]?.code).toBe('CMD_UNKNOWN_AGGREGATE');
  });

  it('CMD_AGGREGATE_WITHOUT_STATE_MACHINE for non-stateful entity', () => {
    const g = graphFor({
      aggregate: 'Project',
      aggregateId: { $param: 'id' },
      transition: 'assign',
      payload: {},
    });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs[0]?.code).toBe('CMD_AGGREGATE_WITHOUT_STATE_MACHINE');
  });

  it('CMD_UNKNOWN_TRANSITION when transition name missing', () => {
    const g = graphFor({
      aggregate: 'Issue',
      aggregateId: { $param: 'id' },
      transition: 'ghost',
      payload: {},
    });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs[0]?.code).toBe('CMD_UNKNOWN_TRANSITION');
  });

  it('CMD_PAYLOAD_MISSING_FIELD when an affects field is not in payload', () => {
    const g = graphFor({
      aggregate: 'Issue',
      aggregateId: { $param: 'id' },
      transition: 'assign',
      payload: {},
    });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs.some((e) => e.code === 'CMD_PAYLOAD_MISSING_FIELD')).toBe(true);
  });

  it('CMD_PAYLOAD_EXTRANEOUS_FIELD when payload has field outside affects', () => {
    const g = graphFor({
      aggregate: 'Issue',
      aggregateId: { $param: 'id' },
      transition: 'assign',
      payload: { assigneeId: { $param: 'assigneeId' }, title: { $param: 'id' } },
    });
    const errs = checkEmit(g, PDM, QSM);
    expect(errs.some((e) => e.code === 'CMD_PAYLOAD_EXTRANEOUS_FIELD')).toBe(true);
  });

  it('CMD_MULTI_AGGREGATE_NOT_ALLOWED across two emits with different aggregateId', () => {
    const p = parseAuthoringSpec({
      version: '1.0-rc7',
      pdmRef: 'p',
      qsmRef: 'q',
      shapes: {},
      graphs: {
        g: {
          id: 'g',
          signature: {
            inputs: {
              a: { type: 'integer', mode: 'required' },
              b: { type: 'integer', mode: 'required' },
              assigneeId: { type: 'integer', mode: 'required' },
            },
            output: { type: 'row<CommandResult>', from: 'e2' },
          },
          nodes: [
            {
              id: 'e1',
              type: 'emit',
              config: {
                aggregate: 'Issue',
                aggregateId: { $param: 'a' },
                transition: 'assign',
                payload: { assigneeId: { $param: 'assigneeId' } },
              },
            },
            {
              id: 'e2',
              type: 'emit',
              config: {
                aggregate: 'Issue',
                aggregateId: { $param: 'b' },
                transition: 'assign',
                payload: { assigneeId: { $param: 'assigneeId' } },
              },
            },
          ],
        },
      },
    });
    if (!p.ok) throw new Error('parse failed');
    const errs = checkEmit(normalize(p.value).graphs.g!, PDM, QSM);
    expect(errs.some((e) => e.code === 'CMD_MULTI_AGGREGATE_NOT_ALLOWED')).toBe(true);
  });
});
