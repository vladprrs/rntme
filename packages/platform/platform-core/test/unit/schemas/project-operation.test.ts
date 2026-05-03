import { describe, expect, it } from 'vitest';
import {
  StartProjectUpdateOperationRequestSchema,
  StartProjectDeleteOperationRequestSchema,
  ProjectOperationSchema,
  ProjectOperationLogLineSchema,
} from '../../../src/schemas/project-operation.js';

describe('project operation schemas', () => {
  it('accepts update by existing project version seq', () => {
    const r = StartProjectUpdateOperationRequestSchema.safeParse({
      projectVersionSeq: 4,
      targetSlug: 'dokploy-preview',
    });

    expect(r.success).toBe(true);
  });

  it('accepts update by uploaded canonical project bundle', () => {
    const r = StartProjectUpdateOperationRequestSchema.safeParse({
      bundle: {
        contentType: 'application/rntme-project-bundle+json',
        bytesBase64: Buffer.from('{"files":{}}').toString('base64'),
      },
    });

    expect(r.success).toBe(true);
  });

  it('rejects update requests with both version and bundle', () => {
    const r = StartProjectUpdateOperationRequestSchema.safeParse({
      projectVersionSeq: 4,
      bundle: {
        contentType: 'application/rntme-project-bundle+json',
        bytesBase64: Buffer.from('{}').toString('base64'),
      },
    });

    expect(r.success).toBe(false);
  });

  it('rejects update requests without a source', () => {
    const r = StartProjectUpdateOperationRequestSchema.safeParse({
      targetSlug: 'dokploy-preview',
    });

    expect(r.success).toBe(false);
  });

  it('requires exact delete confirmation payload shape', () => {
    expect(StartProjectDeleteOperationRequestSchema.safeParse({ confirm: 'notes-demo' }).success).toBe(true);
    expect(StartProjectDeleteOperationRequestSchema.safeParse({}).success).toBe(false);
  });

  it('parses project operation and log line rows', () => {
    const operation = ProjectOperationSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      orgId: '22222222-2222-4222-8222-222222222222',
      projectId: '33333333-3333-4333-8333-333333333333',
      kind: 'delete',
      status: 'queued',
      requestedByAccountId: '44444444-4444-4444-8444-444444444444',
      requestedByTokenId: null,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: { confirm: 'notes-demo' },
      result: null,
      errorCode: null,
      errorMessage: null,
      queuedAt: new Date('2026-05-03T12:00:00Z'),
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
    });
    expect(operation.kind).toBe('delete');

    const line = ProjectOperationLogLineSchema.parse({
      id: 1,
      operationId: operation.id,
      orgId: operation.orgId,
      ts: new Date('2026-05-03T12:00:01Z'),
      level: 'info',
      step: 'teardown',
      message: 'deleted application app_1',
    });
    expect(line.step).toBe('teardown');
  });
});
