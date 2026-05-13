import { describe, expect, it, mock } from 'bun:test';
import type { Buffer } from 'node:buffer';
import { createOpenRouterModule } from '../../src/handler.js';

type FetchMock = ReturnType<typeof mock>;

function asFetch(fetchMock: FetchMock): typeof globalThis.fetch {
  return fetchMock as unknown as typeof globalThis.fetch;
}

function makeBus(): { events: { type: string; data: unknown }[]; emit: (type: string, data: unknown) => Promise<void> } {
  const events: { type: string; data: unknown }[] = [];
  return {
    events,
    emit: async (type, data) => {
      events.push({ type, data });
    },
  };
}

function makeStore(): {
  store: { get: (k: string) => Promise<Buffer | null>; put: (k: string, b: Buffer) => Promise<void>; evictExpired: () => Promise<number>; close: () => Promise<void> };
  records: Map<string, Buffer>;
} {
  const records = new Map<string, Buffer>();
  return {
    records,
    store: {
      get: async (k) => records.get(k) ?? null,
      put: async (k, b) => void records.set(k, b),
      evictExpired: async () => 0,
      close: async () => {},
    },
  };
}

const happyOrResponse = {
  id: 'gen-1',
  model: 'openai/gpt-4o',
  choices: [{ message: { role: 'assistant', content: 'extracted JSON here' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

const sampleRequest = {
  context: { idempotencyKey: 'idem-abc', correlationId: 'corr-1' },
  model: 'openrouter/openai/gpt-4o',
  messages: [{ role: 'user', content: [{ type: 1, text: { text: 'hi' } }] }],
};

describe('Complete RPC', () => {
  it('happy path emits Started + Finished, calls OR once, returns Completion', async () => {
    const fetchMock = mock().mockResolvedValue({ ok: true, status: 200, json: async () => happyOrResponse, text: async () => '' });
    const bus = makeBus();
    const { records, store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: asFetch(fetchMock), store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });

    const completion = (await mod.Complete!(sampleRequest)) as { ref: { canonical_id: string } };
    expect(completion.ref.canonical_id).toBe('idem-abc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bus.events.map((e) => e.type)).toEqual(['CompletionStarted', 'CompletionFinished']);
    expect(records.has('idem-abc')).toBe(true);
  });

  it('accepts snake_case CommandContext from gRPC deserialization', async () => {
    const fetchMock = mock().mockResolvedValue({ ok: true, status: 200, json: async () => happyOrResponse, text: async () => '' });
    const bus = makeBus();
    const { records, store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: asFetch(fetchMock), store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });

    const completion = (await mod.Complete!({
      ...sampleRequest,
      context: { idempotency_key: 'idem-snake', correlation_id: 'corr-snake' },
    })) as { ref: { canonical_id: string } };

    expect(completion.ref.canonical_id).toBe('idem-snake');
    expect(bus.events[0]?.data).toMatchObject({ correlationId: 'corr-snake' });
    expect(records.has('idem-snake')).toBe(true);
  });

  it('idempotent — second call with same key returns cached, no second OR call', async () => {
    const fetchMock = mock().mockResolvedValue({ ok: true, status: 200, json: async () => happyOrResponse, text: async () => '' });
    const bus = makeBus();
    const { store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: asFetch(fetchMock), store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });
    await mod.Complete!(sampleRequest);
    await mod.Complete!(sampleRequest);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('OR 429 → AI_LLM_VENDOR_RATE_LIMITED + CompletionFailed', async () => {
    const fetchMock = mock()
      .mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: { code: 'rate_limit', message: 'too many' } }), text: async () => '' });
    const bus = makeBus();
    const { store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: asFetch(fetchMock), store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });
    await expect(mod.Complete!(sampleRequest)).rejects.toMatchObject({ aiLlmCode: 'AI_LLM_VENDOR_RATE_LIMITED' });
    expect(bus.events.map((e) => e.type)).toEqual(['CompletionStarted', 'CompletionFailed']);
  });
});

describe('GetCompletion RPC', () => {
  it('returns cached completion when found', async () => {
    const fetchMock = mock().mockResolvedValue({ ok: true, status: 200, json: async () => happyOrResponse, text: async () => '' });
    const bus = makeBus();
    const { store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: asFetch(fetchMock), store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });
    await mod.Complete!(sampleRequest);
    const got = (await mod.GetCompletion!({ canonicalId: 'idem-abc' })) as { ref: { canonical_id: string } };
    expect(got.ref.canonical_id).toBe('idem-abc');
  });

  it('returns COMPLETION_NOT_FOUND when missing', async () => {
    const fetchMock = mock();
    const bus = makeBus();
    const { store } = makeStore();
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', fetch: asFetch(fetchMock), store, bus, now: () => Date.parse('2026-05-06T10:00:00Z') });
    await expect(mod.GetCompletion!({ canonicalId: 'never' })).rejects.toMatchObject({ aiLlmCode: 'AI_LLM_REFERENCES_COMPLETION_NOT_FOUND' });
  });
});

describe('Unimplemented RPCs', () => {
  it('all 12 non-implemented RPCs throw UNIMPLEMENTED', async () => {
    const mod = createOpenRouterModule({ apiKey: 'sk', baseUrl: 'https://or', store: makeStore().store, bus: makeBus(), now: () => 0 });
    const unimplementedRpcs = [
      'CreateThread', 'GetThread', 'DeleteThread', 'AddMessage', 'ListThreadItems',
      'RunThread', 'GetThreadRun', 'CancelThreadRun',
      'SubmitJob', 'GetJob', 'CancelJob', 'ListJobs',
    ];
    for (const rpc of unimplementedRpcs) {
      const handler = (mod as Record<string, (req: unknown) => Promise<unknown>>)[rpc]!;
      await expect(handler({})).rejects.toMatchObject({ code: 12 /* UNIMPLEMENTED */ });
    }
  });
});
