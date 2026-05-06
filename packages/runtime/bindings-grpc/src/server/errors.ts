import * as grpc from '@grpc/grpc-js';
import type { OperationExecutorError } from '@rntme/bindings-http/operation-contract';

export function mapExecutorErrorToGrpcStatus(
  err: OperationExecutorError,
): grpc.status {
  switch (err.code) {
    case 'OPERATION_NOT_FOUND':
      return grpc.status.UNIMPLEMENTED;
    case 'OPERATION_GUARD_REJECTED':
      return grpc.status.FAILED_PRECONDITION;
    case 'OPERATION_CONCURRENCY_CONFLICT':
      return grpc.status.ABORTED;
    case 'OPERATION_EXECUTION_FAILED':
      return grpc.status.INTERNAL;
    case 'OPERATION_HANDLER_ERROR':
      return grpc.status.INVALID_ARGUMENT;
    default:
      return grpc.status.UNKNOWN;
  }
}
