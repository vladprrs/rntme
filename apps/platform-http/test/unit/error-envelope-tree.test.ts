import { describe, it, expect } from 'bun:test';
import { errorEnvelope } from '../../src/middleware/error-handler.js';
import type { PlatformError } from '@rntme/platform-core';

describe('errorEnvelope with structured errors[] tree', () => {
  it('preserves nested errors[] on each PlatformError', () => {
    const e: PlatformError = {
      code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
      message: 'bad',
      stage: 'validation',
      errors: [
        {
          code: 'BLUEPRINT_WORKFLOWS_INVALID',
          message: 'failed',
          path: 'workflows/workflows.json',
          cause: [{ code: 'WORKFLOWS_FILE_MISSING', message: 'missing' }],
        },
      ],
    };
    const env = errorEnvelope([e]);
    expect(env.error.errors).toBeDefined();
    expect(env.error.errors?.[0]?.cause).toBeDefined();
    expect(env.error.errors?.[0]?.cause?.[0]?.code).toBe('WORKFLOWS_FILE_MISSING');
  });
});
