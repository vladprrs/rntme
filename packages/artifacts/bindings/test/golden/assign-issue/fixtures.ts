import type {
  BindingResolvers,
  GraphSignature,
  ResolvedShape,
} from '../../../src/types/resolvers.js';

const assignIssueSig: GraphSignature = {
  id: 'assignIssueSafe',
  inputs: {
    issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
    assigneeId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
    actor: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
  },
  output: { type: { kind: 'row', shape: 'AssignIssueResult' }, from: 'result' },
  effects: {
    localReads: true,
    localEmits: [{ aggregate: 'Issue', transition: 'assign', eventType: 'IssueAssigned' }],
    calls: [],
    waits: false,
  },
};

const assignIssueResult: ResolvedShape = {
  name: 'AssignIssueResult',
  origin: 'custom',
  fields: {
    issueId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    assigned: { type: { kind: 'scalar', primitive: 'boolean' }, nullable: false },
  },
};

export const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'assignIssueSafe' ? assignIssueSig : null),
  resolveShape: (name: string): ResolvedShape | null => (name === 'AssignIssueResult' ? assignIssueResult : null),
};
