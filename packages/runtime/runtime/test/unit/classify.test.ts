import { describe, it, expect } from 'bun:test';
import * as grpc from '@grpc/grpc-js';
import { classifyGrpcError } from '../../src/plugins/adapter-client/classify.js';

describe('classifyGrpcError', () => {
  it.each([
    [grpc.status.DEADLINE_EXCEEDED,  'transient'],
    [grpc.status.UNAVAILABLE,         'transient'],
    [grpc.status.RESOURCE_EXHAUSTED,  'transient'],
    [grpc.status.INTERNAL,            'transient'],
    [grpc.status.UNKNOWN,             'transient'],
    [grpc.status.INVALID_ARGUMENT,    'terminal'],
    [grpc.status.NOT_FOUND,           'terminal'],
    [grpc.status.FAILED_PRECONDITION, 'terminal'],
    [grpc.status.PERMISSION_DENIED,   'terminal'],
    [grpc.status.UNAUTHENTICATED,     'terminal'],
    [grpc.status.ALREADY_EXISTS,      'terminal'],
    [grpc.status.ABORTED,             'terminal'],  // concurrency conflict surfaced from module is a domain error
  ] as const)('status %d → %s', (status, expected) => {
    expect(classifyGrpcError(status)).toBe(expected);
  });
});
