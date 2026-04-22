import { execute as executeGraphIr, type CompileResult } from '@rntme/graph-ir-compiler';
import type {
  QueryExecutor,
  QueryExecutorInput,
  QueryExecutorOutput,
} from './types.js';

export type GraphIrQueryMap = Record<string, CompileResult>;

export class GraphIrQueryExecutor implements QueryExecutor {
  private readonly queries: GraphIrQueryMap;

  constructor(queries: GraphIrQueryMap) {
    this.queries = queries;
  }

  async execute(input: QueryExecutorInput): Promise<QueryExecutorOutput> {
    const compiled = this.queries[input.queryName];
    if (compiled === undefined) {
      return {
        ok: false,
        error: { code: 'QUERY_NOT_FOUND', message: `no compiled query for "${input.queryName}"` },
      };
    }
    try {
      const value = executeGraphIr(compiled, input.inputs, input.ctx.qsmDb);
      return { ok: true, value };
    } catch (e) {
      return {
        ok: false,
        error: {
          code: 'QUERY_HANDLER_THREW',
          message: e instanceof Error ? e.message : String(e),
          detail: e instanceof Error ? { name: e.name, stack: e.stack } : e,
        },
      };
    }
  }
}
