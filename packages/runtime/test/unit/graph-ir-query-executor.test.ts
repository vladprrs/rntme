import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import type { CompileResult } from '@rntme/graph-ir-compiler';
import { GraphIrQueryExecutor } from '../../src/plugins/executors/graph-ir-query-executor.js';
import type { QueryExecutionContext } from '../../src/plugins/executors/types.js';

function mkCtx(qsmDb: QueryExecutionContext['qsmDb']): QueryExecutionContext {
  return { qsmDb };
}

function mkCompiled(overrides: Partial<CompileResult> = {}): CompileResult {
  return {
    sql: 'select 1 as answer',
    paramOrder: [],
    shape: { name: 'Answer' },
    optionalParams: [],
    paramDefaults: {},
    ...overrides,
  };
}

describe('GraphIrQueryExecutor', () => {
  let db: Database.Database;

  afterEach(() => {
    db.close();
  });

  beforeEach(() => {
    db = new Database(':memory:');
  });

  it('executes a registered query and returns the graph-ir result', async () => {
    const executor = new GraphIrQueryExecutor({
      answer: mkCompiled(),
    });

    const out = await executor.execute({
      queryName: 'answer',
      inputs: {},
      ctx: mkCtx(db),
    });

    expect(out).toEqual({
      ok: true,
      value: [{ answer: 1 }],
    });
  });

  it('returns QUERY_NOT_FOUND for an unknown query name', async () => {
    const executor = new GraphIrQueryExecutor({});

    const out = await executor.execute({
      queryName: 'missing',
      inputs: {},
      ctx: mkCtx(db),
    });

    expect(out).toEqual({
      ok: false,
      error: {
        code: 'QUERY_NOT_FOUND',
        message: 'no compiled query for "missing"',
      },
    });
  });

  it('maps thrown query execution errors to QUERY_HANDLER_THREW', async () => {
    const executor = new GraphIrQueryExecutor({
      broken: mkCompiled({ sql: 'select from' }),
    });

    const out = await executor.execute({
      queryName: 'broken',
      inputs: {},
      ctx: mkCtx(db),
    });

    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error).toMatchObject({
        code: 'QUERY_HANDLER_THREW',
      });
      expect(out.error.message).toMatch(/syntax/i);
      expect(out.error.detail).toMatchObject({
        name: 'Error',
      });
    }
  });
});
