import { describe, expect, it, vi } from 'vitest';
import { createAuthedTransport } from '../../src/transport.js';

describe('createAuthedTransport', () => {
  it('injects Authorization: Bearer when a token is present and preserves caller headers', async () => {
    const baseFetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const transport = createAuthedTransport({
      baseFetch,
      getToken: () => 'tok',
      onUnauthenticated: vi.fn()
    });

    await transport('/x', { headers: { 'x-request-id': 'r1' } });

    expect(baseFetch).toHaveBeenCalledOnce();
    const init = vi.mocked(baseFetch).mock.calls[0]![1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('x-request-id')).toBe('r1');
  });

  it('does not inject Authorization when the token provider returns null', async () => {
    const baseFetch = vi.fn(async () => new Response('{}', { status: 200 })) as unknown as typeof fetch;
    const transport = createAuthedTransport({
      baseFetch,
      getToken: () => null,
      onUnauthenticated: vi.fn()
    });

    await transport('/x', {});

    const init = vi.mocked(baseFetch).mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get('authorization')).toBeNull();
  });

  it('calls the unauthenticated callback and throws on 401', async () => {
    const baseFetch = vi.fn(async () => new Response('{}', { status: 401 })) as unknown as typeof fetch;
    const onUnauthenticated = vi.fn();
    const transport = createAuthedTransport({
      baseFetch,
      getToken: () => 'tok',
      onUnauthenticated
    });

    await expect(transport('/x', {})).rejects.toThrow('UI_AUTH_SHELL_UNAUTHENTICATED');
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });
});
