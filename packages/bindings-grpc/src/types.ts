import type { Server } from '@grpc/grpc-js';
import type {
  CommandExecutor,
  QueryExecutor,
} from '@rntme/bindings-http/executor-contract';
import type { ValidatedBindings, ResolvedShape } from '@rntme/bindings';
import type { EventStore } from '@rntme/event-store';
import type BetterSqlite3 from 'better-sqlite3';

export type GrpcServerOptions = {
  validated: ValidatedBindings;
  shapes: Record<string, ResolvedShape>;
  packageName: string;
  serviceName: string;
  commandExecutor: CommandExecutor;
  queryExecutor: QueryExecutor;
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database;
  now?: () => string;
  nextId?: () => string;
};

export type GrpcServerHandle = {
  server: Server;
  protoSource: string;
  listen(port: number, host?: string): Promise<number>;
  stop(): Promise<void>;
};
