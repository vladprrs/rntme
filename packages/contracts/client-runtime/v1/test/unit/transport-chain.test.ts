import { describe, expect, it, vi } from 'vitest';
import { createTransportChain } from '../../src/transport-chain.js';

describe('TransportChain', () => {
  it('returns base fetch when no middleware registered', async () => {
    const baseFetch = vi.fn(async () => new Response('ok'));
    const chain = createTransportChain(baseFetch);
    const r = await chain.fetch(new Request('https://x/y'));
    expect(await r.text()).toBe('ok');
    expect(baseFetch).toHaveBeenCalled();
  });

  it('runs registered middleware around base fetch (single mw)', async () => {
    const baseFetch = vi.fn(async (req: Request) => {
      expect(req.headers.get('authorization')).toBe('Bearer t');
      return new Response('ok');
    });
    const chain = createTransportChain(baseFetch);
    chain.use(async (req, next) => {
      const h = new Headers(req.headers);
      h.set('authorization', 'Bearer t');
      const newReq = new Request(req, { headers: h });
      return next(newReq);
    });
    await chain.fetch(new Request('https://x/y'));
    expect(baseFetch).toHaveBeenCalled();
  });

  it('composes multiple middleware in registration order (later wraps earlier)', async () => {
    const trace: string[] = [];
    const baseFetch = vi.fn(async () => {
      trace.push('base');
      return new Response('ok');
    });
    const chain = createTransportChain(baseFetch);
    chain.use(async (req, next) => {
      trace.push('mw1-pre');
      const r = await next(req);
      trace.push('mw1-post');
      return r;
    });
    chain.use(async (req, next) => {
      trace.push('mw2-pre');
      const r = await next(req);
      trace.push('mw2-post');
      return r;
    });
    await chain.fetch(new Request('https://x/y'));
    expect(trace).toEqual(['mw2-pre', 'mw1-pre', 'base', 'mw1-post', 'mw2-post']);
  });
});
