import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from '../../../src/middleware/request-id.js';
import { errorHandler } from '../../../src/middleware/error-handler.js';

describe('errorHandler', () => {
  it('emits a sanitized 500 with the default INTERNAL_ERROR code and logs request metadata', async () => {
    const error = mock();
    const cause = new Error('boom');
    const app = new Hono();
    app.use('*', requestId());
    app.onError(errorHandler({ logger: { error } as never }));
    app.get('/boom/:id', () => {
      throw cause;
    });

    const res = await app.request('/boom/123', { headers: { 'x-request-id': 'req-1' } });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
    expect(error).toHaveBeenCalledWith(
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
  });

  it('honors a custom error code for callers that want to keep their own envelope', async () => {
    const app = new Hono();
    app.use('*', requestId());
    app.onError(errorHandler({ code: 'PLATFORM_INTERNAL' }));
    app.get('/boom', () => {
      throw new Error('x');
    });

    const res = await app.request('/boom');
    expect(await res.json()).toEqual({
      error: { code: 'PLATFORM_INTERNAL', message: 'Internal server error' },
    });
  });

  it('omits the logger call when no logger is supplied', async () => {
    const app = new Hono();
    app.use('*', requestId());
    app.onError(errorHandler());
    app.get('/boom', () => {
      throw new Error('x');
    });
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
  });
});
