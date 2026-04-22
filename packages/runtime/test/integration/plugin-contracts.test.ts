import { runDbDriverContract, runEventBusContract } from '../../src/plugins/contract-tests.js';
import { BetterSqliteDriver } from '../../src/plugins/better-sqlite-driver.js';
import { InMemoryBus } from '../../src/plugins/in-memory-bus.js';

runDbDriverContract(new BetterSqliteDriver());
runEventBusContract(() => new InMemoryBus());

import {
  runCommandExecutorContract,
  runQueryExecutorContract,
} from '../../src/plugins/contract-tests.js';
import { CodeCommandExecutor } from '../../src/plugins/executors/code-command-executor.js';
import { GraphIrCommandExecutor } from '../../src/plugins/executors/graph-ir-command-executor.js';
import { GraphIrQueryExecutor } from '../../src/plugins/executors/graph-ir-query-executor.js';
import type { CompiledCommand, CompileResult } from '@rntme/graph-ir-compiler';

runCommandExecutorContract('CodeCommandExecutor', () =>
  new CodeCommandExecutor({
    contractEcho: async (_ctx, input) => ({
      ok: true,
      value: {
        aggregateId: String(input.id),
        version: 1,
        eventIds: ['id-1'],
        commandId: 'cmd-1',
        correlationId: 'corr-1',
      },
    }),
  }),
);

runCommandExecutorContract('GraphIrCommandExecutor', () => {
  const compiled = {
    graphId: 'contractEcho',
    aggregate: 'A',
    readPrelude: null,
    readPreludeGuardNodeId: null,
    paramOrder: ['id'],
    optionalParams: [],
    paramDefaults: {},
    emits: [
      {
        nodeId: 'emit-1',
        aggregate: 'A',
        aggregateIdExpr: { $param: 'id' },
        transition: 'echo',
        eventType: 'ContractEchoed',
        affects: ['status'],
        payloadExprs: { status: { $literal: 'done' } },
        isCreation: true,
        isSelfLoop: false,
        fromStates: [null],
        toState: 'done',
      },
    ],
  } as unknown as CompiledCommand;
  return new GraphIrCommandExecutor({ contractEcho: compiled });
});

runQueryExecutorContract('GraphIrQueryExecutor', () => {
  const compiled = {
    sql: 'SELECT 1 AS a',
    paramOrder: [],
    shape: { name: 'ContractNoop' },
    optionalParams: [],
    paramDefaults: {},
  } satisfies CompileResult;
  return new GraphIrQueryExecutor({ contractNoop: compiled });
});
