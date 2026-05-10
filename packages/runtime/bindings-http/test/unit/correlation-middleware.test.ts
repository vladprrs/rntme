import { describe, it, expect } from 'bun:test';
import { Hono } from 'hono';
import { correlationMiddleware } from '../../src/runtime/correlation-middleware.js';

type Vars = {
  Variables: {
    correlation: { commandId: string; correlationId: string; traceparent: string | null };
  };
};

function buildApp(): Hono<Vars> {
  const app = new Hono<Vars>();
  app.use('*', correlationMiddleware());
  app.get('/ping', (c) => c.json(c.get('correlation')));
  return app;
}

describe('correlationMiddleware', () => {
  it('generates both ids when no headers present', async () => {
    const res = await buildApp().request('/ping');
    const body = (await res.json()) as {
      commandId: string;
      correlationId: string;
      traceparent: string | null;
    };
    expect(body.commandId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.traceparent).toBeNull();
    expect(res.headers.get('Correlation-Id')).toBe(body.correlationId);
  });

  it('propagates incoming Correlation-Id', async () => {
    const res = await buildApp().request('/ping', { headers: { 'Correlation-Id': 'abc' } });
    const body = (await res.json()) as { commandId: string; correlationId: string };
    expect(body.correlationId).toBe('abc');
    expect(body.commandId).not.toBe('abc');
    expect(res.headers.get('Correlation-Id')).toBe('abc');
  });

  it('extracts correlationId from traceparent when no Correlation-Id', async () => {
    const tp = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const res = await buildApp().request('/ping', { headers: { traceparent: tp } });
    const body = (await res.json()) as { correlationId: string; traceparent: string | null };
    expect(body.correlationId).toBe('0af7651916cd43dd8448eb211c80319c');
    expect(body.traceparent).toBe(tp);
  });

  it('Correlation-Id wins over traceparent when both present', async () => {
    const tp = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
    const res = await buildApp().request('/ping', {
      headers: { 'Correlation-Id': 'manual', traceparent: tp },
    });
    const body = (await res.json()) as { correlationId: string; traceparent: string | null };
    expect(body.correlationId).toBe('manual');
    expect(body.traceparent).toBe(tp);
  });

  it('tolerates malformed traceparent (sets to null, does not throw)', async () => {
    const res = await buildApp().request('/ping', { headers: { traceparent: 'not-a-valid-tp' } });
    const body = (await res.json()) as { correlationId: string; traceparent: string | null };
    expect(body.traceparent).toBeNull();
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects empty Correlation-Id header and falls back to generated id', async () => {
    const res = await buildApp().request('/ping', { headers: { 'Correlation-Id': '' } });
    const body = (await res.json()) as { correlationId: string };
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.correlationId).not.toBe('');
  });

  it('rejects Correlation-Id exceeding 128 chars', async () => {
    const huge = 'a'.repeat(129);
    const res = await buildApp().request('/ping', { headers: { 'Correlation-Id': huge } });
    const body = (await res.json()) as { correlationId: string };
    expect(body.correlationId).not.toBe(huge);
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('rejects Correlation-Id with disallowed characters (e.g. whitespace, slash)', async () => {
    const res = await buildApp().request('/ping', {
      headers: { 'Correlation-Id': 'abc def/ghi' },
    });
    const body = (await res.json()) as { correlationId: string };
    expect(body.correlationId).not.toBe('abc def/ghi');
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('accepts Correlation-Id at 128-char boundary', async () => {
    const max = 'a'.repeat(128);
    const res = await buildApp().request('/ping', { headers: { 'Correlation-Id': max } });
    const body = (await res.json()) as { correlationId: string };
    expect(body.correlationId).toBe(max);
  });
});
