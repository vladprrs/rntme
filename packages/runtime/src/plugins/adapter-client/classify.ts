import * as grpc from '@grpc/grpc-js';

export type Classification = 'transient' | 'terminal';

export function classifyGrpcError(status: grpc.status): Classification {
  switch (status) {
    case grpc.status.DEADLINE_EXCEEDED:
    case grpc.status.UNAVAILABLE:
    case grpc.status.RESOURCE_EXHAUSTED:
    case grpc.status.INTERNAL:
    case grpc.status.UNKNOWN:
      return 'transient';
    default:
      return 'terminal';
  }
}
