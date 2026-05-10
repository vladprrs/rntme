import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const ns = proto.rntme.contracts.ai_llm.v1;

function ref(canonical_id: string, vendor_id = 'vendor-1') {
  return {
    canonical_id,
    vendor_id,
    module_name: 'module-ai-llm-openai',
    module_version: '0.1.0',
    contract_version: 'v1',
  };
}

describe('AI/LLM v1 aggregates round-trip', () => {
  it('Completion preserves content, usage, and finish reason', () => {
    const original = ns.Completion.create({
      ref: ref('cmpl-1', 'chatcmpl-abc'),
      model: 'openai/gpt-4o',
      content: [{ type: ns.ContentBlockType.CONTENT_BLOCK_TYPE_TEXT, text: { text: 'Hello' } }],
      finish_reason: ns.FinishReason.FINISH_REASON_STOP,
      usage: { input_tokens: 12, output_tokens: 4, reasoning_tokens: 0, cached_tokens: 0, total_tokens: 16 },
    });

    const round = ns.Completion.decode(ns.Completion.encode(original).finish());

    expect(round.ref?.canonical_id).toBe('cmpl-1');
    expect(round.model).toBe('openai/gpt-4o');
    expect(round.content.at(0)?.text?.text).toBe('Hello');
    expect(round.usage?.total_tokens).toBe(16);
    expect(round.finish_reason).toBe(ns.FinishReason.FINISH_REASON_STOP);
  });

  it('Completion preserves thinking and tool_use blocks', () => {
    const original = ns.Completion.create({
      model: 'anthropic/claude-sonnet-4-5',
      finish_reason: ns.FinishReason.FINISH_REASON_TOOL_CALLS,
      content: [
        { type: ns.ContentBlockType.CONTENT_BLOCK_TYPE_THINKING, thinking: { text: 'Need a lookup.', redacted: false } },
        {
          type: ns.ContentBlockType.CONTENT_BLOCK_TYPE_TOOL_USE,
          tool_use: {
            id: 'tooluse-1',
            name: 'get_weather',
            arguments: { fields: { city: { stringValue: 'Berlin' } } },
          },
        },
      ],
    });

    const round = ns.Completion.decode(ns.Completion.encode(original).finish());

    expect(round.content).toHaveLength(2);
    expect(round.content.at(0)?.thinking?.text).toBe('Need a lookup.');
    expect(round.content.at(1)?.tool_use?.name).toBe('get_weather');
  });

  it('AssistantThread preserves status and metadata', () => {
    const original = ns.AssistantThread.create({
      ref: ref('thr-1', 'thread-abc'),
      title: 'Customer support session',
      status: ns.ThreadStatus.THREAD_STATUS_ACTIVE,
      metadata: { public: { fields: { tag: { stringValue: 'support' } } } },
    });

    const round = ns.AssistantThread.decode(ns.AssistantThread.encode(original).finish());

    expect(round.title).toBe('Customer support session');
    expect(round.status).toBe(ns.ThreadStatus.THREAD_STATUS_ACTIVE);
    expect(round.ref?.canonical_id).toBe('thr-1');
  });

  it('ThreadItem preserves role, content, and run linkage', () => {
    const original = ns.ThreadItem.create({
      item_id: 'item-1',
      thread_id: 'thr-1',
      role: 'assistant',
      run_id: 'run-1',
      content: [{ type: ns.ContentBlockType.CONTENT_BLOCK_TYPE_TEXT, text: { text: 'How can I help?' } }],
    });

    const round = ns.ThreadItem.decode(ns.ThreadItem.encode(original).finish());

    expect(round.role).toBe('assistant');
    expect(round.run_id).toBe('run-1');
    expect(round.content.at(0)?.text?.text).toBe('How can I help?');
  });

  it('ThreadRun preserves required tool calls', () => {
    const original = ns.ThreadRun.create({
      ref: ref('run-1', 'resp-abc'),
      thread_id: 'thr-1',
      status: ns.ThreadRunStatus.THREAD_RUN_STATUS_REQUIRES_ACTION,
      model: 'openai/gpt-4o',
      required_tool_calls: [
        { id: 'tc-1', name: 'get_weather', arguments: { fields: { city: { stringValue: 'Berlin' } } } },
      ],
    });

    const round = ns.ThreadRun.decode(ns.ThreadRun.encode(original).finish());

    expect(round.status).toBe(ns.ThreadRunStatus.THREAD_RUN_STATUS_REQUIRES_ACTION);
    expect(round.required_tool_calls.at(0)?.name).toBe('get_weather');
  });

  it('AsyncJob preserves type, progress, and result URI', () => {
    const original = ns.AsyncJob.create({
      ref: ref('job-1', 'batch-abc'),
      type: ns.AsyncJobType.ASYNC_JOB_TYPE_BATCH_COMPLETION,
      status: ns.AsyncJobStatus.ASYNC_JOB_STATUS_COMPLETED,
      progress_percentage: 100,
      result_uri: 'https://files.example.com/batch/output.jsonl',
    });

    const round = ns.AsyncJob.decode(ns.AsyncJob.encode(original).finish());

    expect(round.type).toBe(ns.AsyncJobType.ASYNC_JOB_TYPE_BATCH_COMPLETION);
    expect(round.status).toBe(ns.AsyncJobStatus.ASYNC_JOB_STATUS_COMPLETED);
    expect(round.progress_percentage).toBe(100);
    expect(round.result_uri).toContain('output.jsonl');
  });

  it('BatchCompletionPayload nests CreateCompletionRequest', () => {
    const original = ns.BatchCompletionPayload.create({
      completion_window: '24h',
      items: [
        {
          custom_id: 'req-1',
          request: {
            context: { idempotency_key: 'k1', correlation_id: 'c1', actor_user_id: 'u1', actor_type: 'user' },
            model: 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: [{ type: ns.ContentBlockType.CONTENT_BLOCK_TYPE_TEXT, text: { text: '2+2?' } }] }],
          },
        },
      ],
    });

    const round = ns.BatchCompletionPayload.decode(ns.BatchCompletionPayload.encode(original).finish());

    expect(round.items.at(0)?.custom_id).toBe('req-1');
    expect(round.items.at(0)?.request?.model).toBe('openai/gpt-4o-mini');
  });
});

describe('AI/LLM v1 enums', () => {
  it('keeps protobuf zero and vendor-specific sentinels', () => {
    expect(ns.FinishReason.FINISH_REASON_UNSPECIFIED).toBe(0);
    expect(ns.FinishReason.FINISH_REASON_VENDOR_SPECIFIC).toBe(100);
    expect(ns.ContentBlockType.CONTENT_BLOCK_TYPE_UNSPECIFIED).toBe(0);
    expect(ns.ContentBlockType.CONTENT_BLOCK_TYPE_VENDOR_SPECIFIC).toBe(100);
    expect(ns.ThreadStatus.THREAD_STATUS_VENDOR_SPECIFIC).toBe(100);
    expect(ns.ThreadRunStatus.THREAD_RUN_STATUS_VENDOR_SPECIFIC).toBe(100);
    expect(ns.AsyncJobType.ASYNC_JOB_TYPE_VENDOR_SPECIFIC).toBe(100);
    expect(ns.AsyncJobStatus.ASYNC_JOB_STATUS_VENDOR_SPECIFIC).toBe(100);
  });

  it('exposes canonical reasoning and async values', () => {
    expect(ns.ReasoningEffort.REASONING_EFFORT_MAX).toBe(5);
    expect(ns.ReasoningVisibility.REASONING_VISIBILITY_FULL).toBe(3);
    expect(ns.AsyncJobType.ASYNC_JOB_TYPE_BATCH_COMPLETION).toBe(1);
    expect(ns.AsyncJobStatus.ASYNC_JOB_STATUS_EXPIRED).toBe(8);
  });
});
