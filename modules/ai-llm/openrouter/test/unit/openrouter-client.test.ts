import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { OpenRouterClient } from '../../src/openrouter-client.js';

type FetchMock = ReturnType<typeof mock>;

function asFetch(fetchMock: FetchMock): typeof globalThis.fetch {
  return fetchMock as unknown as typeof globalThis.fetch;
}

describe('OpenRouterClient', () => {
  let fetchMock: FetchMock;
  beforeEach(() => {
    fetchMock = mock();
  });
  afterEach(() => {
    mock.restore();
  });

  it('POSTs to /chat/completions with Bearer auth and JSON body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'gen-1' }),
      text: async () => '{"id":"gen-1"}',
    });
    const client = new OpenRouterClient({ apiKey: 'sk-test', baseUrl: 'https://or/api/v1', fetch: asFetch(fetchMock) });
    const res = await client.chatCompletions({ model: 'openai/gpt-4o', messages: [] });
    expect(res).toEqual({ id: 'gen-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://or/api/v1/chat/completions');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws { httpStatus, orError } on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'invalid_api_key', message: 'bad key' } }),
      text: async () => '{"error":{"code":"invalid_api_key","message":"bad key"}}',
    });
    const client = new OpenRouterClient({ apiKey: 'sk', baseUrl: 'https://or/api/v1', fetch: asFetch(fetchMock) });
    await expect(client.chatCompletions({ model: 'm', messages: [] })).rejects.toMatchObject({
      httpStatus: 401,
      orError: { code: 'invalid_api_key' },
    });
  });

  it('wraps network errors with networkError', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ENOTFOUND'));
    const client = new OpenRouterClient({ apiKey: 'sk', baseUrl: 'https://or/api/v1', fetch: asFetch(fetchMock) });
    await expect(client.chatCompletions({ model: 'm', messages: [] })).rejects.toMatchObject({
      networkError: expect.any(Error),
    });
  });
});
