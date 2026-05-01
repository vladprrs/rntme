import { describe, it, expect } from 'vitest';
import { generateOpenApi } from '../../../src/openapi/emit.js';
import type { ValidatedBindings } from '../../../src/types/artifact.js';
import type { BindingResolvers, GraphSignature, ResolvedShape } from '../../../src/types/resolvers.js';
import {
  COMMAND_RESULT_SHAPE_NAME,
  commandResultJsonSchema,
  commandResultShape,
} from '../../../src/openapi/command-result.js';

const row: ResolvedShape = {
  name: 'Row',
  origin: 'custom',
  fields: {
    id: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
    name: { type: { kind: 'scalar', primitive: 'string' }, nullable: true },
  },
};

const signature: GraphSignature = {
  id: 'g',
  inputs: {
    limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
  },
  output: { type: { kind: 'rowset', shape: 'Row' }, from: 't' },
};

const validated: ValidatedBindings = {
  artifact: {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'y',
    qsmRef: 'z',
    openapi: { info: { title: 'API', version: '1.0.0' } },
    bindings: {
      primary: {
        graph: 'g',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET',
          path: '/v1/things',
          parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
          tags: ['things'],
          summary: 'List things',
        },
      },
    },
  } as unknown as ValidatedBindings['artifact'],
  resolved: {
    primary: {
      entry: {
        graph: 'g',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET',
          path: '/v1/things',
          parameters: [{ name: 'limit', in: 'query', bindTo: 'limit', required: false }],
          tags: ['things'],
          summary: 'List things',
        },
      },
      signature,
      outputShape: row,
    },
  },
} as unknown as ValidatedBindings;

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => (id === 'g' ? signature : null),
  resolveShape: (name) => (name === 'Row' ? row : null),
};

describe('generateOpenApi', () => {
  it('emits a minimal valid document', () => {
    const r = generateOpenApi(validated, resolvers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doc = r.value;
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('API');
    expect(doc.components.schemas.Row).toBeDefined();
    expect(doc.components.schemas.ErrorResponse).toBeDefined();

    const op = doc.paths['/v1/things']?.get;
    expect(op?.operationId).toBe('primary');
    expect(op?.summary).toBe('List things');
    expect(op?.tags).toEqual(['things']);
    expect(op?.parameters?.[0]?.name).toBe('limit');
    expect(op?.responses['200']?.content?.['application/json']?.schema).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/Row' },
    });
    expect(Object.keys(op?.responses ?? {}).sort()).toEqual(['200', '400', '422', '500']);
  });

  it('uses http.operationId override when set', () => {
    const v = structuredClone(validated);
    v.resolved.primary!.entry.http.operationId = 'listThings';
    v.artifact.bindings.primary!.http.operationId = 'listThings';
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.paths['/v1/things']?.get?.operationId).toBe('listThings');
  });

  it('falls back to options.info/servers when artifact lacks them', () => {
    const v = structuredClone(validated);
    delete (v.artifact as { openapi?: unknown }).openapi;
    const r = generateOpenApi(v, resolvers, {
      info: { title: 'FromOptions', version: '0.0.1' },
      servers: [{ url: 'https://api.example.com' }],
    });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.info.title).toBe('FromOptions');
    expect(r.value.servers).toEqual([{ url: 'https://api.example.com' }]);
  });

  it('uses ultimate fallback info when neither artifact nor options provide it', () => {
    const v = structuredClone(validated);
    delete (v.artifact as { openapi?: unknown }).openapi;
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.info).toEqual({ title: 'API', version: '0.0.0' });
  });

  it('omits standard errors when option set to false', () => {
    const r = generateOpenApi(validated, resolvers, { standardErrors: false });
    if (!r.ok) throw new Error('expected ok');
    expect(Object.keys(r.value.paths['/v1/things']?.get?.responses ?? {})).toEqual(['200']);
    expect(r.value.components.schemas.ErrorResponse).toBeUndefined();
  });

  it('decimalEncoding=number switches decimal schema', () => {
    const shape: ResolvedShape = {
      name: 'Row',
      origin: 'custom',
      fields: { price: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false } },
    };
    const v = structuredClone(validated);
    v.resolved.primary!.outputShape = shape;
    const r = generateOpenApi(v, resolvers, { decimalEncoding: 'number' });
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.components.schemas.Row).toEqual({
      type: 'object',
      required: ['price'],
      properties: { price: { type: 'number' } },
    });
  });

  it('merges http.openapi passthrough into operation', () => {
    const v = structuredClone(validated);
    v.resolved.primary!.entry.http.openapi = { 'x-rate-limit': { max: 60 } };
    v.artifact.bindings.primary!.http.openapi = { 'x-rate-limit': { max: 60 } };
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.paths['/v1/things']?.get?.['x-rate-limit']).toEqual({ max: 60 });
  });

  it('merges parameter openapi passthrough', () => {
    const v = structuredClone(validated);
    v.resolved.primary!.entry.http.parameters[0]!.openapi = { example: 5 };
    v.artifact.bindings.primary!.http.parameters[0]!.openapi = { example: 5 };
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(r.value.paths['/v1/things']?.get?.parameters?.[0]?.example).toBe(5);
  });

  it('deduplicates shapes shared across bindings', () => {
    const v = structuredClone(validated);
    const entry2 = structuredClone(v.resolved.primary!.entry);
    entry2.http.path = '/v1/other';
    v.resolved.secondary = {
      entry: entry2,
      signature,
      outputShape: row,
    };
    v.artifact.bindings.secondary = entry2;
    const r = generateOpenApi(v, resolvers);
    if (!r.ok) throw new Error('expected ok');
    expect(Object.keys(r.value.components.schemas).sort()).toEqual(['ErrorResponse', 'Row']);
  });

  it('emits a command binding with single-object response + 409 + CommandResult schema', () => {
    const cmdSig: GraphSignature = {
      id: 'assignIssue',
      role: 'command',
      inputs: {
        issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
        assigneeId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
        actor: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
      },
      output: { type: { kind: 'row', shape: COMMAND_RESULT_SHAPE_NAME }, from: 'emitAssign' },
    };

    const cmdEntry = {
      kind: 'command' as const,
      graph: 'assignIssue',
      target: { engine: 'sqlite', dialect: 'sqlite' },
      http: {
        method: 'POST' as const,
        path: '/v1/issues/{issueId}/actions/assign',
        parameters: [
          { name: 'issueId', in: 'path' as const, bindTo: 'issueId', required: true },
          { name: 'assigneeId', in: 'body' as const, bindTo: 'assigneeId', required: true },
          { name: 'actor', in: 'body' as const, bindTo: 'actor', required: true },
        ],
        tags: ['issues'],
        summary: 'Assign an issue',
      },
    };

    const v: ValidatedBindings = {
      artifact: {
        version: '1.0',
        graphSpecRef: 'x',
        pdmRef: 'y',
        qsmRef: 'z',
        bindings: { assignIssue: cmdEntry },
      } as unknown as ValidatedBindings['artifact'],
      resolved: {
        assignIssue: { entry: cmdEntry, signature: cmdSig, outputShape: commandResultShape() },
      },
    } as unknown as ValidatedBindings;

    const cmdResolvers: BindingResolvers = {
      resolveGraphSignature: (id) => (id === 'assignIssue' ? cmdSig : null),
      resolveShape: () => null,
    };

    const r = generateOpenApi(v, cmdResolvers);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const op = r.value.paths['/v1/issues/{issueId}/actions/assign']?.post;
    expect(op?.operationId).toBe('assignIssue');
    expect(op?.responses['200']?.content?.['application/json']?.schema).toEqual({
      $ref: `#/components/schemas/${COMMAND_RESULT_SHAPE_NAME}`,
    });
    expect(Object.keys(op?.responses ?? {}).sort()).toEqual(['200', '400', '409', '422', '500']);
    expect(r.value.components.schemas.CommandResult).toEqual(commandResultJsonSchema());
  });
});
