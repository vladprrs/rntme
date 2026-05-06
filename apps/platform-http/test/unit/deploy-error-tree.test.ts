import { describe, it, expect } from 'vitest';
import { deployErrorsToPlatformError } from '../../src/deploy/executor.js';

describe('deployErrorsToPlatformError', () => {
  it('preserves nested cause arrays as PlatformErrorNode tree', () => {
    const platformError = deployErrorsToPlatformError(
      [
        {
          code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON',
          message: 'workflow projects require provisioned Operaton config',
          path: 'workflows.engine',
          cause: [
            { code: 'DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT', message: 'use rntme target create...' },
          ],
        },
      ],
      'plan',
    );
    expect(platformError.code).toBe('PLATFORM_INTERNAL');
    expect(platformError.errors).toBeDefined();
    const firstNode = platformError.errors![0]!;
    expect(firstNode.cause).toBeDefined();
    const firstCause = firstNode.cause![0]!;
    expect(firstCause.code).toBe('DEPLOY_PLAN_WORKFLOWS_REQUIRE_OPERATON_HINT');
  });
});
