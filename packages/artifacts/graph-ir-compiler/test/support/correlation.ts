import type { CorrelationCtx } from '../../src/command-runtime/execute.js';

export function testCorrelation(overrides: Partial<CorrelationCtx> = {}): CorrelationCtx {
  return {
    commandId: 'cmd-test',
    correlationId: 'corr-test',
    traceparent: null,
    ...overrides,
  };
}
