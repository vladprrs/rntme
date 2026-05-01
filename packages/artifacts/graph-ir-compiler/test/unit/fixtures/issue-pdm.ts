import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';

export const RAW_ISSUE_PDM = {
  entities: {
    Issue: {
      ownerService: 'issue-tracker',
      kind: 'owned' as const,
      table: 'issues',
      fields: {
        id: { type: 'integer' as const, nullable: false, column: 'id' },
        projectId: { type: 'integer' as const, nullable: false, column: 'project_id' },
        reporterId: { type: 'integer' as const, nullable: false, column: 'reporter_id' },
        assigneeId: { type: 'integer' as const, nullable: true, column: 'assignee_id' },
        title: { type: 'string' as const, nullable: false, column: 'title' },
        status: { type: 'string' as const, nullable: false, column: 'status' },
        priority: { type: 'string' as const, nullable: false, column: 'priority' },
        storyPoints: { type: 'integer' as const, nullable: false, column: 'story_points' },
        resolvedAt: { type: 'datetime' as const, nullable: true, column: 'resolved_at' },
      },
      relations: {},
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['draft', 'open', 'in_progress', 'resolved', 'closed'],
        transitions: {
          report: {
            from: null,
            to: 'draft',
            affects: ['title', 'projectId', 'reporterId', 'priority', 'storyPoints'],
          },
          submit: { from: 'draft', to: 'open' },
          assign: { from: 'open', to: 'in_progress', affects: ['assigneeId'] },
          reassign: { from: 'in_progress', to: 'in_progress', affects: ['assigneeId'] },
          resolve: { from: 'in_progress', to: 'resolved', affects: ['resolvedAt'] },
          reopen: { from: 'resolved', to: 'open' },
          close: { from: 'resolved', to: 'closed' },
        },
      },
    },
    Project: {
      ownerService: 'issue-tracker',
      kind: 'owned' as const,
      table: 'projects',
      fields: { id: { type: 'integer' as const, nullable: false, column: 'id' } },
      relations: {},
      keys: ['id'],
    },
  },
} as const;

export const RAW_ISSUE_QSM_EMPTY = { projections: {}, relations: {} } as const;

function unwrapPdm() {
  const parsed = parsePdm(RAW_ISSUE_PDM);
  if (!parsed.ok) throw new Error(`parsePdm: ${JSON.stringify(parsed.errors)}`);
  const val = validatePdm(parsed.value);
  if (!val.ok) throw new Error(`validatePdm: ${JSON.stringify(val.errors)}`);
  return val.value;
}

export const ISSUE_PDM = unwrapPdm();

const qsmParsed = parseQsm(RAW_ISSUE_QSM_EMPTY);
if (!qsmParsed.ok) throw new Error(`parseQsm: ${JSON.stringify(qsmParsed.errors)}`);
const qsmVal = validateQsm(qsmParsed.value, createPdmResolver(ISSUE_PDM));
if (!qsmVal.ok) throw new Error(`validateQsm: ${JSON.stringify(qsmVal.errors)}`);
export const ISSUE_QSM_EMPTY = qsmVal.value;
