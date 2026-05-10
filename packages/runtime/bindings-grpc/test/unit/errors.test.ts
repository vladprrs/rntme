import { describe, it, expect } from 'bun:test';
import * as grpc from '@grpc/grpc-js';
import { mapExecutorErrorToGrpcStatus } from '../../src/server/errors.js';

describe('mapExecutorErrorToGrpcStatus', () => {
  it('OPERATION_NOT_FOUND -> UNIMPLEMENTED', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'OPERATION_NOT_FOUND', message: '' })).toBe(
      grpc.status.UNIMPLEMENTED,
    );
  });
  it('OPERATION_GUARD_REJECTED -> FAILED_PRECONDITION', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'OPERATION_GUARD_REJECTED', message: '' })).toBe(
      grpc.status.FAILED_PRECONDITION,
    );
  });
  it('OPERATION_CONCURRENCY_CONFLICT -> ABORTED', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'OPERATION_CONCURRENCY_CONFLICT', message: '' })).toBe(
      grpc.status.ABORTED,
    );
  });
  it('OPERATION_EXECUTION_FAILED -> INTERNAL', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'OPERATION_EXECUTION_FAILED', message: '' })).toBe(
      grpc.status.INTERNAL,
    );
  });
  it('OPERATION_HANDLER_ERROR -> INVALID_ARGUMENT (domain-level)', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'OPERATION_HANDLER_ERROR', message: '' })).toBe(
      grpc.status.INVALID_ARGUMENT,
    );
  });
});
