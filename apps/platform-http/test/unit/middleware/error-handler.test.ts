import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { errorEnvelope, errorHandler, statusForCode } from '../../../src/middleware/error-handler.js';
import { requestId } from '../../../src/middleware/request-id.js';

describe('error-handler helpers', () => {
  it('statusForCode maps known PLATFORM_* codes to HTTP statuses', () => {
    expect(statusForCode('PLATFORM_AUTH_MISSING')).toBe(401);
    expect(statusForCode('PLATFORM_AUTH_FORBIDDEN')).toBe(403);
    expect(statusForCode('PLATFORM_TENANCY_PROJECT_NOT_FOUND')).toBe(404);
    expect(statusForCode('PLATFORM_CONFLICT_SLUG_TAKEN')).toBe(409);
    expect(statusForCode('PLATFORM_TENANCY_RESOURCE_ARCHIVED')).toBe(410);
    expect(statusForCode('PLATFORM_VALIDATION_BUNDLE_FAILED')).toBe(422);
    expect(statusForCode('PLATFORM_RATE_LIMITED')).toBe(429);
    expect(statusForCode('PLATFORM_STORAGE_DB_UNAVAILABLE')).toBe(503);
  });
  it('errorEnvelope shapes the JSON body', () => {
    const e = errorEnvelope([{ code: 'PLATFORM_INTERNAL', message: 'oops' }]);
    expect(e.error.code).toBe('PLATFORM_INTERNAL');
  });
  it('logs unhandled exceptions with request metadata and returns sanitized 500', async () => {
    const logger = { error: vi.fn() };
    const cause = new Error('secret boom');
    const app = new Hono();
    app.use('*', requestId());
    app.onError(errorHandler(logger));
    app.get('/boom/:id', () => {
      throw cause;
    });

    const res = await app.request('/boom/123?token=secret', {
      headers: { 'x-request-id': 'req-1' },
    });

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        err: cause,
        requestId: 'req-1',
        method: 'GET',
        path: '/boom/123',
        route: '/boom/:id',
        status: 500,
      }),
      'unhandled error',
    );
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_INTERNAL', message: 'Internal server error' },
    });
  });
});
