import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const EXPECTED_RPCS = [
  'Complete',
  'GetCompletion',
  'CreateThread',
  'GetThread',
  'DeleteThread',
  'AddMessage',
  'ListThreadItems',
  'RunThread',
  'GetThreadRun',
  'CancelThreadRun',
  'SubmitJob',
  'GetJob',
  'CancelJob',
  'ListJobs',
] as const;

const EXPECTED_EVENTS = [
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

const EXPECTED_RPC_EVENT_FIXTURE_NAMES = {
  Complete: ['CompletionStarted', 'CompletionFinished', 'CompletionFailed'],
  GetCompletion: [],
  CreateThread: ['ThreadCreated'],
  GetThread: [],
  DeleteThread: ['ThreadDeleted'],
  AddMessage: ['ThreadMessageAdded'],
  ListThreadItems: [],
  RunThread: ['ThreadRunStarted', 'ThreadRunRequiresAction', 'ThreadRunCompleted', 'ThreadRunFailed'],
  GetThreadRun: [],
  CancelThreadRun: ['ThreadRunCancelled'],
  SubmitJob: ['AsyncJobSubmitted'],
  GetJob: [],
  CancelJob: ['AsyncJobCancelled'],
  ListJobs: [],
} satisfies Record<(typeof EXPECTED_RPCS)[number], readonly (typeof EXPECTED_EVENTS)[number][]>;

function rpcNamesFromPrototype(): Set<string> {
  const Cons = proto.rntme.contracts.ai_llm.v1.AiLlmModule;
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(Cons.prototype)) {
    if (key === 'constructor') continue;
    const fn = (Cons.prototype as unknown as Record<string, unknown>)[key];
    if (typeof fn !== 'function') continue;
    const name = (fn as { name?: string }).name;
    if (name && /^[A-Z][a-zA-Z0-9]*$/.test(name)) names.add(name);
  }
  return names;
}

describe('service AiLlmModule shape', () => {
  it('declares exactly 14 RPCs by canonical name', () => {
    const methodNames = rpcNamesFromPrototype();
    expect(methodNames.size).toBe(14);
    expect([...methodNames].sort()).toEqual([...EXPECTED_RPCS].sort());
  });

  it('every event short-name is exported as a Message constructor', () => {
    const ns = proto.rntme.contracts.ai_llm.v1 as Record<string, unknown>;
    for (const evt of EXPECTED_EVENTS) {
      expect(ns[evt], `event message ${evt} missing from generated proto`).toBeDefined();
    }
    expect(EXPECTED_EVENTS.length).toBe(16);
  });

  it('keeps the RPC short-name to event-fixture-name mapping in sync', () => {
    expect(Object.keys(EXPECTED_RPC_EVENT_FIXTURE_NAMES).sort()).toEqual([...EXPECTED_RPCS].sort());

    const eventSet = new Set(EXPECTED_EVENTS);
    for (const [rpc, eventNames] of Object.entries(EXPECTED_RPC_EVENT_FIXTURE_NAMES)) {
      expect(EXPECTED_RPCS.includes(rpc as (typeof EXPECTED_RPCS)[number]), `unexpected RPC mapping key ${rpc}`).toBe(true);
      for (const eventName of eventNames) {
        expect(eventSet.has(eventName as (typeof EXPECTED_EVENTS)[number]), `${rpc} maps to unknown event fixture ${eventName}`).toBe(true);
      }
    }
  });

  it('exports aggregate and helper message constructors', () => {
    const ns = proto.rntme.contracts.ai_llm.v1 as Record<string, unknown>;
    for (const name of [
      'Completion',
      'AssistantThread',
      'ThreadItem',
      'ThreadRun',
      'AsyncJob',
      'BatchCompletionPayload',
      'BatchCompletionItem',
      'TokenUsage',
      'SamplingParams',
      'ReasoningInfo',
      'ToolDefinition',
      'ToolCall',
      'ToolResult',
      'Message',
      'ContentBlock',
      'TextBlock',
      'ImageBlock',
      'AudioBlock',
      'FileBlock',
      'ThinkingBlock',
    ]) {
      expect(ns[name], `${name} missing`).toBeDefined();
    }
  });

  it('Complete and GetCompletion are both canonical RPCs (pair-rule)', () => {
    expect(EXPECTED_RPCS).toContain('Complete');
    expect(EXPECTED_RPCS).toContain('GetCompletion');
    // GetCompletion does not emit events (read-only); Complete emits 3.
    expect(EXPECTED_RPC_EVENT_FIXTURE_NAMES.GetCompletion).toEqual([]);
    expect(EXPECTED_RPC_EVENT_FIXTURE_NAMES.Complete).toEqual([
      'CompletionStarted',
      'CompletionFinished',
      'CompletionFailed',
    ]);
  });
});
