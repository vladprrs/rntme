import { describe, it, expect } from 'vitest';
import * as grpc from '@grpc/grpc-js';
import { mapExecutorErrorToGrpcStatus } from '../../src/server/errors.js';

describe('mapExecutorErrorToGrpcStatus', () => {
  it('COMMAND_NOT_FOUND → UNIMPLEMENTED', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_NOT_FOUND', message: '' })).toBe(
      grpc.status.UNIMPLEMENTED,
    );
  });
  it('COMMAND_GUARD_REJECTED → FAILED_PRECONDITION', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_GUARD_REJECTED', message: '' })).toBe(
      grpc.status.FAILED_PRECONDITION,
    );
  });
  it('COMMAND_CONCURRENCY_CONFLICT → ABORTED', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_CONCURRENCY_CONFLICT', message: '' })).toBe(
      grpc.status.ABORTED,
    );
  });
  it('COMMAND_HANDLER_THREW → INTERNAL', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_HANDLER_THREW', message: '' })).toBe(
      grpc.status.INTERNAL,
    );
  });
  it('COMMAND_HANDLER_ERROR → INVALID_ARGUMENT (domain-level)', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'COMMAND_HANDLER_ERROR', message: '' })).toBe(
      grpc.status.INVALID_ARGUMENT,
    );
  });
  it('QUERY_NOT_FOUND → UNIMPLEMENTED', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'QUERY_NOT_FOUND', message: '' })).toBe(
      grpc.status.UNIMPLEMENTED,
    );
  });
  it('QUERY_HANDLER_THREW → INTERNAL', () => {
    expect(mapExecutorErrorToGrpcStatus({ code: 'QUERY_HANDLER_THREW', message: '' })).toBe(
      grpc.status.INTERNAL,
    );
  });
});
