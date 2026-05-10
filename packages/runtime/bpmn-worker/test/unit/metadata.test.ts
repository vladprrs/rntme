import { describe, expect, it } from 'bun:test';

import { buildCommandMetadata } from '../../src/index.js';

describe('buildCommandMetadata', () => {
  it('builds deterministic command metadata', () => {
    const metadata = buildCommandMetadata({
      processInstanceId: 'proc_1',
      taskId: 'reserveStock',
      activityInstanceId: 'act_1',
      sourceEventId: 'evt_1',
      sourceCorrelationId: 'corr_1',
      previousCommandId: null,
    });

    expect(metadata).toEqual({
      commandId: 'bpmn:proc_1:reserveStock:act_1',
      correlationId: 'corr_1',
      causationId: 'evt_1',
    });
  });
});
