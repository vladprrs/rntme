import { describe, it, expect } from 'bun:test';
import type {
  OpenApiDoc,
  JsonSchema,
  OperationObject,
  ParameterObject,
  ResponseObject,
  PathItem,
} from '../../../src/types/openapi.js';

describe('openapi types', () => {
  it('constructs a minimal OpenAPI 3.1 document', () => {
    const schema: JsonSchema = { type: 'integer' };
    const param: ParameterObject = { name: 'limit', in: 'query', required: false, schema };
    const resp: ResponseObject = {
      description: 'OK',
      content: { 'application/json': { schema: { type: 'array', items: schema } } },
    };
    const op: OperationObject = {
      operationId: 'list',
      parameters: [param],
      responses: { '200': resp },
    };
    const path: PathItem = { get: op };
    const doc: OpenApiDoc = {
      openapi: '3.1.0',
      info: { title: 'API', version: '0.0.0' },
      paths: { '/things': path },
      components: { schemas: {} },
    };
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/things']?.get?.operationId).toBe('list');
  });
});
