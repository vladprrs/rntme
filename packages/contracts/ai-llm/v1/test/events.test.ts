import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const ns = proto.rntme.contracts.ai_llm.v1;

const EVENT_NAMES = [
  'CompletionStarted',
  'CompletionFinished',
  'CompletionFailed',
  'ThreadCreated',
  'ThreadDeleted',
  'ThreadMessageAdded',
  'ThreadRunStarted',
  'ThreadRunRequiresAction',
  'ThreadRunCompleted',
  'ThreadRunFailed',
  'ThreadRunCancelled',
  'AsyncJobSubmitted',
  'AsyncJobStatusChanged',
  'AsyncJobCompleted',
  'AsyncJobFailed',
  'AsyncJobCancelled',
] as const;

function ref(canonical_id: string) {
  return { canonical_id, vendor_id: 'vendor-1', module_name: 'module-ai-llm-openai', module_version: '0.1.0', contract_version: 'v1' };
}

describe('AI/LLM v1 event payloads', () => {
  it('exports exactly 16 event types', () => {
    for (const name of EVENT_NAMES) {
      expect(ns[name], `event ${name} missing`).toBeDefined();
    }
    expect(EVENT_NAMES.length).toBe(16);
  });

  it('CompletionStarted round-trip', () => {
    const round = ns.CompletionStarted.decode(
      ns.CompletionStarted.encode(
        ns.CompletionStarted.create({ completion_id: 'cmpl-1', model: 'openai/gpt-4o', input_token_estimate: 100 }),
      ).finish(),
    );
    expect(round.completion_id).toBe('cmpl-1');
    expect(round.input_token_estimate).toBe(100);
  });

  it('CompletionFinished embeds Completion aggregate', () => {
    const round = ns.CompletionFinished.decode(
      ns.CompletionFinished.encode(
        ns.CompletionFinished.create({ completion: { ref: ref('cmpl-1'), model: 'anthropic/claude-sonnet-4-5', finish_reason: 1 } }),
      ).finish(),
    );
    expect(round.completion?.model).toBe('anthropic/claude-sonnet-4-5');
  });

  it('CompletionFailed carries error_code', () => {
    const round = ns.CompletionFailed.decode(
      ns.CompletionFailed.encode(
        ns.CompletionFailed.create({
          completion_id: 'cmpl-1',
          model: 'openai/gpt-4o',
          error_code: 'AI_LLM_VENDOR_RATE_LIMITED',
          error_message: 'rate limit hit',
        }),
      ).finish(),
    );
    expect(round.error_code).toBe('AI_LLM_VENDOR_RATE_LIMITED');
  });

  it('thread lifecycle events round-trip', () => {
    const created = ns.ThreadCreated.decode(
      ns.ThreadCreated.encode(
        ns.ThreadCreated.create({ thread: { ref: ref('thr-1'), status: 1 }, creator_user_id: 'user-1', initial_message_count: 3 }),
      ).finish(),
    );
    expect(created.thread?.ref?.canonical_id).toBe('thr-1');

    const deleted = ns.ThreadDeleted.decode(
      ns.ThreadDeleted.encode(ns.ThreadDeleted.create({ canonical_id: 'thr-1', vendor_id: 'v', hard_delete: true })).finish(),
    );
    expect(deleted.hard_delete).toBe(true);
  });

  it('thread message and run events round-trip', () => {
    const added = ns.ThreadMessageAdded.decode(
      ns.ThreadMessageAdded.encode(
        ns.ThreadMessageAdded.create({
          item: { item_id: 'item-1', thread_id: 'thr-1', role: 'user', content: [{ type: 1, text: { text: 'hi' } }] },
        }),
      ).finish(),
    );
    expect(added.item?.role).toBe('user');

    const requiresAction = ns.ThreadRunRequiresAction.decode(
      ns.ThreadRunRequiresAction.encode(
        ns.ThreadRunRequiresAction.create({
          thread_id: 'thr-1',
          run_id: 'run-1',
          required_tool_calls: [{ id: 'tc-1', name: 'lookup', arguments: {} }],
        }),
      ).finish(),
    );
    expect(requiresAction.required_tool_calls.at(0)?.name).toBe('lookup');

    const completed = ns.ThreadRunCompleted.decode(
      ns.ThreadRunCompleted.encode(
        ns.ThreadRunCompleted.create({
          run: { ref: ref('run-1'), status: ns.ThreadRunStatus.THREAD_RUN_STATUS_COMPLETED },
          new_items: [{ item_id: 'item-2', thread_id: 'thr-1', role: 'assistant', content: [{ type: 1, text: { text: 'done' } }] }],
        }),
      ).finish(),
    );
    expect(completed.new_items.at(0)?.role).toBe('assistant');

    const failed = ns.ThreadRunFailed.decode(
      ns.ThreadRunFailed.encode(
        ns.ThreadRunFailed.create({
          run: { ref: ref('run-1'), status: ns.ThreadRunStatus.THREAD_RUN_STATUS_FAILED },
          error_code: 'AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED',
          error_message: 'context too long',
        }),
      ).finish(),
    );
    expect(failed.error_code).toBe('AI_LLM_VENDOR_CONTEXT_WINDOW_EXCEEDED');

    const cancelled = ns.ThreadRunCancelled.decode(
      ns.ThreadRunCancelled.encode(ns.ThreadRunCancelled.create({ thread_id: 'thr-1', run_id: 'run-1', reason: 'user_action' })).finish(),
    );
    expect(cancelled.reason).toBe('user_action');
  });

  it('AsyncJob events round-trip', () => {
    const submitted = ns.AsyncJobSubmitted.decode(
      ns.AsyncJobSubmitted.encode(
        ns.AsyncJobSubmitted.create({ job: { ref: ref('job-1'), type: 1, status: 2 }, type: 1, input_item_count: 50 }),
      ).finish(),
    );
    expect(submitted.input_item_count).toBe(50);

    const changed = ns.AsyncJobStatusChanged.decode(
      ns.AsyncJobStatusChanged.encode(
        ns.AsyncJobStatusChanged.create({ canonical_id: 'job-1', type: 1, previous_status: 2, new_status: 3, progress_percentage: 25 }),
      ).finish(),
    );
    expect(changed.progress_percentage).toBe(25);

    const completed = ns.AsyncJobCompleted.decode(
      ns.AsyncJobCompleted.encode(
        ns.AsyncJobCompleted.create({ job: { ref: ref('job-1'), type: 1, status: 5, result_uri: 'https://files.example.com/x.jsonl' } }),
      ).finish(),
    );
    expect(completed.job?.result_uri).toContain('jsonl');

    const failed = ns.AsyncJobFailed.decode(
      ns.AsyncJobFailed.encode(
        ns.AsyncJobFailed.create({ job: { ref: ref('job-1'), type: 1, status: 6 }, error_code: 'AI_LLM_VENDOR_QUOTA_EXCEEDED' }),
      ).finish(),
    );
    expect(failed.error_code).toBe('AI_LLM_VENDOR_QUOTA_EXCEEDED');

    const cancelled = ns.AsyncJobCancelled.decode(
      ns.AsyncJobCancelled.encode(ns.AsyncJobCancelled.create({ job: { ref: ref('job-1'), type: 1, status: 7 }, reason: 'admin' })).finish(),
    );
    expect(cancelled.reason).toBe('admin');
  });
});
