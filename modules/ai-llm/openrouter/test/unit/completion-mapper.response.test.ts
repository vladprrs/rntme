import { describe, expect, it } from 'vitest';
import { parseOpenRouterResponse } from '../../src/completion-mapper.js';

describe('parseOpenRouterResponse', () => {
  const baseRequest = {
    model: 'openrouter/openai/gpt-4o',
    idempotencyKey: 'idem-1',
    requestStartedAt: new Date('2026-05-06T10:00:00Z'),
  };

  it('maps a text-only completion', () => {
    const orResponse = {
      id: 'gen-abc',
      model: 'openai/gpt-4o',
      choices: [{ message: { role: 'assistant', content: 'Hello world.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
    };
    const completion = parseOpenRouterResponse(orResponse, baseRequest);
    expect(completion.ref?.canonicalId).toBe('idem-1');
    expect(completion.model).toBe('openrouter/openai/gpt-4o');
    expect(completion.content).toEqual([{ type: 1, text: { text: 'Hello world.' } }]);
    expect(completion.finishReason).toBe(1); // STOP
    expect(completion.usage).toEqual({ inputTokens: 10, outputTokens: 3, totalTokens: 13, reasoningTokens: 0, cachedTokens: 0 });
  });

  it('maps tool_calls to TOOL_USE content blocks', () => {
    const orResponse = {
      id: 'gen-def',
      model: 'openai/gpt-4o',
      choices: [
        {
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'extract', arguments: '{"x":1}' } }],
          },
          finish_reason: 'tool_calls',
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
    };
    const completion = parseOpenRouterResponse(orResponse, baseRequest);
    expect(completion.finishReason).toBe(3); // TOOL_CALLS
    expect(completion.toolCalls).toEqual([{ id: 'call_1', name: 'extract', arguments: { x: 1 } }]);
    expect(completion.content?.some((b: { type: number }) => b.type === 5)).toBe(true);
  });

  it('routes usage.cost to vendor_raw', () => {
    const orResponse = {
      id: 'gen-cost',
      model: 'openai/gpt-4o',
      choices: [{ message: { role: 'assistant', content: 'x' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, cost: 0.0042 },
    };
    const completion = parseOpenRouterResponse(orResponse, baseRequest);
    const vr = completion.vendorRaw as { cost_usd?: number };
    expect(vr.cost_usd).toBe(0.0042);
  });

  it('maps finish_reason length and content_filter', () => {
    for (const [or, want] of [
      ['stop', 1],
      ['length', 2],
      ['tool_calls', 3],
      ['content_filter', 4],
    ] as const) {
      const completion = parseOpenRouterResponse(
        {
          id: 'gen',
          model: 'openai/gpt-4o',
          choices: [{ message: { role: 'assistant', content: 'x' }, finish_reason: or }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        },
        baseRequest,
      );
      expect(completion.finishReason).toBe(want);
    }
  });
});
