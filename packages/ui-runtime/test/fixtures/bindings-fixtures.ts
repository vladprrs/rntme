// Minimal ValidatedBindings-shaped stub matching what buildBindingResolver needs.
// Keep this narrow: we only use `listIssues` in these tests.
export const validated = {
  bindings: {
    listIssues: {
      kind: 'query' as const,
      graph: 'listIssues',
      http: {
        method: 'GET' as const,
        path: '/v1/issues',
        parameters: [
          { name: 'status', in: 'query' as const, bindTo: 'status', required: false, type: { kind: 'scalar' as const, primitive: 'string' as const } },
        ],
      },
      passthrough: {
        resolvedInputs: [
          { name: 'status', type: { kind: 'scalar' as const, primitive: 'string' as const }, mode: 'nullable' as const },
        ],
        resolvedOutputShape: {
          id: 'IssueList',
          kind: 'list' as const,
          element: { id: 'Issue', kind: 'object' as const, fields: [{ name: 'id', type: { kind: 'scalar' as const, primitive: 'number' as const } }] },
        },
      },
    },
  },
};

export type ValidatedBindings = typeof validated;
export type ResolvedBinding = unknown;
