import { describe, it, expect } from 'bun:test';
import { buildEmitPlans } from '../../../src/emit/plan.js';
import { parseAuthoringSpec } from '../../../src/parse/parse.js';
import { normalize } from '../../../src/canonical/normalize.js';
import { ISSUE_PDM as PDM } from '../fixtures/issue-pdm.js';

describe('buildEmitPlans', () => {
  it('produces one EmitPlan per emit node with correct event type and affects', () => {
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
              id: { type: 'integer', mode: 'required' },
              assigneeId: { type: 'integer', mode: 'required' },
            },
            output: { type: 'row<CommandResult>', from: 'e' },
          },
          nodes: [
            {
              id: 'e',
              type: 'emit',
              config: {
                aggregate: 'Issue',
                aggregateId: { $param: 'id' },
                transition: 'assign',
                payload: { assigneeId: { $param: 'assigneeId' } },
              },
            },
          ],
        },
      },
    });
    if (!p.ok) throw new Error('parse failed');
    const plans = buildEmitPlans(normalize(p.value).graphs.g!, PDM);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.eventType).toBe('IssueAssign');
    expect(plans[0]!.affects).toContain('status');
    expect(plans[0]!.affects).toContain('assigneeId');
    expect(plans[0]!.toState).toBe('in_progress');
    expect(plans[0]!.isCreation).toBe(false);
  });
});
