import * as grpc from '@grpc/grpc-js';
import type {
  CommandExecutorError,
  QueryExecutorError,
} from '@rntme/bindings-http/executor-contract';

export function mapExecutorErrorToGrpcStatus(
  err: CommandExecutorError | QueryExecutorError,
): grpc.status {
  switch (err.code) {
    case 'COMMAND_NOT_FOUND':
    case 'QUERY_NOT_FOUND':
      return grpc.status.UNIMPLEMENTED;
    case 'COMMAND_GUARD_REJECTED':
      return grpc.status.FAILED_PRECONDITION;
    case 'COMMAND_CONCURRENCY_CONFLICT':
      return grpc.status.ABORTED;
    case 'COMMAND_HANDLER_THREW':
    case 'QUERY_HANDLER_THREW':
      return grpc.status.INTERNAL;
    case 'COMMAND_HANDLER_ERROR':
      return grpc.status.INVALID_ARGUMENT;
    default: {
      const _exhaustive: never = err;
      void _exhaustive;
      return grpc.status.UNKNOWN;
    }
  }
}
