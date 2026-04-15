import { runDbDriverContract, runEventBusContract } from '../../src/plugins/contract-tests.js';
import { BetterSqliteDriver } from '../../src/plugins/better-sqlite-driver.js';
import { InMemoryBus } from '../../src/plugins/in-memory-bus.js';

runDbDriverContract(new BetterSqliteDriver());
runEventBusContract(() => new InMemoryBus());
