import type { Server, ServerCredentials } from '@grpc/grpc-js';
import type { OperationExecutor } from '@rntme/bindings-http/operation-contract';
import type { ValidatedBindings, ResolvedShape } from '@rntme/bindings';
import type { EventStore } from '@rntme/event-store';
import type { SqliteDatabase } from '@rntme/sqlite';

export type GrpcServerOptions = {
  validated: ValidatedBindings;
  shapes: Record<string, ResolvedShape>;
  packageName: string;
  serviceName: string;
  operationExecutor: OperationExecutor;
  eventStore: EventStore;
  qsmDb: SqliteDatabase;
  serverCredentials?: ServerCredentials;
  now?: () => string;
  nextId?: () => string;
};

export type GrpcServerHandle = {
  server: Server;
  protoSource: string;
  listen(port: number, host?: string): Promise<number>;
  stop(): Promise<void>;
};
