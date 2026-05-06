import { runDbDriverContract, runEventBusContract } from '../../src/plugins/contract-tests.js';
import { BetterSqliteDriver } from '../../src/plugins/better-sqlite-driver.js';
import { InMemoryBus } from '../../src/plugins/in-memory-bus.js';

runDbDriverContract(new BetterSqliteDriver());
runEventBusContract(() => new InMemoryBus());

import { runGrpcSurfaceContract } from '../../src/plugins/contract-tests.js';
import { GrpcSurface } from '../../src/plugins/grpc-surface.js';

runGrpcSurfaceContract(() =>
  new GrpcSurface({
    port: 0,
    packageName: 'rntme.contract.v1',
    serviceName: 'ContractService',
    operationExecutor: {
      async execute() {
        return { ok: false, error: { code: 'OPERATION_NOT_FOUND', message: 'not configured' } };
      },
    },
    shapes: {},
  }),
);
