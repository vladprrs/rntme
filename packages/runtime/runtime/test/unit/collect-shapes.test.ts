import { describe, expect, it } from 'bun:test';
import type { ResolvedShape, ValidatedBindings } from '@rntme/bindings';
import { collectShapesFromService } from '../../src/start/build-grpc-surface.js';
import type { ValidatedService } from '../../src/types.js';

const issueOutput: ResolvedShape = {
  name: 'Issue',
  origin: 'pdm',
  fields: { id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false } },
};

describe('collectShapesFromService', () => {
  it('includes row and rowset input shapes as well as output shapes', () => {
    const service = {
      bindings: {
        resolved: {
          createIssue: {
            signature: {
              id: 'createIssue',
              inputs: {
                payload: { type: { kind: 'row', shape: 'IssueInput' }, mode: 'required' },
                tags: { type: { kind: 'rowset', shape: 'TagInput' }, mode: 'required' },
                ids: { type: { kind: 'list', element: 'integer' }, mode: 'required' },
              },
              output: { type: { kind: 'row', shape: 'Issue' }, from: 'result' },
            },
            outputShape: issueOutput,
          },
        },
      } as unknown as ValidatedBindings,
      graphSpec: {
        shapes: {
          IssueInput: {
            fields: { title: { type: 'string', nullable: false } },
          },
          TagInput: {
            fields: { label: { type: 'string', nullable: false } },
          },
        },
      },
      pdm: {
        entities: {},
      },
    } as unknown as ValidatedService;

    const shapes = collectShapesFromService(service);

    expect(Object.keys(shapes).sort()).toEqual(['Issue', 'IssueInput', 'TagInput']);
    expect(shapes.IssueInput).toEqual({
      name: 'IssueInput',
      origin: 'custom',
      fields: { title: { type: { kind: 'scalar', primitive: 'string' }, nullable: false } },
    });
    expect(shapes.TagInput).toEqual({
      name: 'TagInput',
      origin: 'custom',
      fields: { label: { type: { kind: 'scalar', primitive: 'string' }, nullable: false } },
    });
  });
});
