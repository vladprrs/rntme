import { describe, it, expectTypeOf } from 'bun:test';
import type { PlatformError, PlatformErrorNode } from '@rntme/platform-core';

describe('PlatformErrorNode', () => {
  it('has code, message, optional path, optional cause tree', () => {
    expectTypeOf<PlatformErrorNode>().toMatchTypeOf<{
      readonly code: string;
      readonly message: string;
      readonly path?: string;
      readonly cause?: readonly PlatformErrorNode[];
    }>();
  });
});

describe('PlatformError', () => {
  it('exposes optional errors[] tree', () => {
    const e: PlatformError = {
      code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
      message: 'bad bundle',
      errors: [
        {
          code: 'BLUEPRINT_WORKFLOWS_INVALID',
          message: 'failed',
          path: 'workflows/workflows.json',
          cause: [{ code: 'WORKFLOWS_FILE_MISSING', message: 'missing bpmn' }],
        },
      ],
    };
    expectTypeOf(e.errors).toEqualTypeOf<readonly PlatformErrorNode[] | undefined>();
  });
});
