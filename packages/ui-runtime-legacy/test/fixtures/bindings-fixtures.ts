// Real ValidatedBindings-shaped stub for use in ui-runtime tests.
// Matches the actual @rntme/bindings ValidatedBindings shape.
// Only `listIssues` is needed for resolver tests.

import type {
  ValidatedBindings,
  BindingResolvers,
  ResolvedShape,
} from '@rntme/bindings';

// Shape stub for IssueList / Issue used by listIssues
const issueShape: ResolvedShape = {
  name: 'Issue',
  origin: 'pdm',
  fields: {
    id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    title: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
    status: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
  },
};

export const mockResolveShape: BindingResolvers['resolveShape'] = (name) => {
  if (name === 'Issue') return issueShape;
  return null;
};

// Minimal ValidatedBindings cast — brands are private unique symbols so we
// use a type assertion; this is fine in test code.
export const validated = {
  artifact: {
    version: '1.0',
    graphSpecRef: 'test.graphs.v1',
    pdmRef: 'test.domain.v1',
    qsmRef: 'test.read.v1',
    bindings: {
      listIssues: {
        graph: 'listIssues',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET' as const,
          path: '/v1/issues',
          parameters: [
            { name: 'status', in: 'query' as const, bindTo: 'status', required: false },
          ],
        },
      },
    },
  },
  resolved: {
    listIssues: {
      entry: {
        graph: 'listIssues',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET' as const,
          path: '/v1/issues',
          parameters: [
            { name: 'status', in: 'query' as const, bindTo: 'status', required: false },
          ],
        },
      },
      signature: {
        id: 'listIssues',
        role: 'query' as const,
        inputs: {
          status: {
            type: { kind: 'scalar' as const, primitive: 'string' as const },
            mode: 'nullable' as const,
          },
        },
        output: {
          type: { kind: 'rowset' as const, shape: 'Issue' },
          from: 'paged',
        },
      },
      outputShape: issueShape,
    },
  },
} as unknown as ValidatedBindings;
