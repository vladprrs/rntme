import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { requestId } from '../../../src/middleware/request-id.js';
import { requestLogger } from '../../../src/middleware/request-logger.js';

describe('requestLogger', () => {
  it('logs requestId, method, path, status, and durationMs after the handler runs', async () => {
    const info = mock();
    const logger = { info, error: () => undefined } as never;
    const app = new Hono()
      .use(requestId())
      .use(requestLogger({ logger }))
      .get('/items/:id', (c) => c.json({ id: c.req.param('id') }));

    const res = await app.request('/items/42', { headers: { 'x-request-id': 'req-7' } });

    expect(res.status).toBe(200);
    expect(info).toHaveBeenCalledTimes(1);
    const [payload, message] = info.mock.calls[0]!;
    expect(message).toBe('request');
    expect(payload).toEqual(
      expect.objectContaining({
        requestId: 'req-7',
        method: 'GET',
        path: '/items/42',
        status: 200,
      }),
    );
    expect(typeof (payload as { durationMs: number }).durationMs).toBe('number');
    expect((payload as { durationMs: number }).durationMs).toBeGreaterThanOrEqual(0);
  });
});
