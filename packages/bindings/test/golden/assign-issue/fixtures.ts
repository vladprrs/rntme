import type {
  BindingResolvers,
  GraphSignature,
  ResolvedShape,
} from '../../../src/types/resolvers.js';

const assignIssueSig: GraphSignature = {
  id: 'assignIssueSafe',
  role: 'command',
  inputs: {
    issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
    assigneeId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
    actor: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
  },
  output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'emitAssign' },
};

export const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'assignIssueSafe' ? assignIssueSig : null),
  resolveShape: (_name: string): ResolvedShape | null => null,
};
