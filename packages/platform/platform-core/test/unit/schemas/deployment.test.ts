import { describe, expect, it } from 'vitest';
import {
  DeploymentStatusSchema,
  StartDeploymentRequestSchema,
} from '../../../src/schemas/deployment.js';

describe('DeploymentStatusSchema', () => {
  it('accepts canonical statuses', () => {
    for (const status of [
      'queued',
      'running',
      'succeeded',
      'succeeded_with_warnings',
      'failed',
      'failed_orphaned',
    ]) {
      expect(DeploymentStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejects unknown statuses', () => {
    expect(DeploymentStatusSchema.safeParse('cancelled').success).toBe(false);
  });
});

describe('StartDeploymentRequestSchema', () => {
  it('rejects a deployment start body without targetSlug', () => {
    const parsed = StartDeploymentRequestSchema.safeParse({ projectVersionSeq: 1 });

    expect(parsed.success).toBe(false);
  });

  it('accepts overrides', () => {
    const parsed = StartDeploymentRequestSchema.safeParse({
      projectVersionSeq: 1,
      targetSlug: 'dokploy-staging',
      configOverrides: {
        integrationModuleImages: { 'mod-x': 'r/mod-x:1' },
        runtimeImage: 'ghcr.io/acme/rntme-runtime:rnt-364',
      },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.configOverrides.runtimeImage).toBe('ghcr.io/acme/rntme-runtime:rnt-364');
  });

  it('preserves the in-memory event bus override', () => {
    const parsed = StartDeploymentRequestSchema.safeParse({
      projectVersionSeq: 1,
      targetSlug: 'dokploy-staging',
      configOverrides: {
        eventBusMode: 'in-memory',
      },
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.configOverrides.eventBusMode).toBe('in-memory');
  });
});
