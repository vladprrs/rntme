import { describe, expect, it } from 'vitest';
import {
  AI_LLM_AGENT_EXECUTION_MODES,
  AI_LLM_ASYNC_JOB_TYPES,
  AI_LLM_CANONICAL_EVENTS,
  AI_LLM_CANONICAL_RPCS,
  AI_LLM_CAPABILITY_FIELDS,
  AI_LLM_INPUT_MODALITIES,
  AI_LLM_REASONING_VISIBILITY,
  aiLlmConformanceSuite,
} from '../src/index.js';

describe('CategoryConformanceSuite shape', () => {
  it('every scenarios entry is an array (possibly empty in v1 skeleton)', () => {
    for (const [rpc, scenarios] of Object.entries(aiLlmConformanceSuite.scenariosByRpc)) {
      expect(Array.isArray(scenarios), `scenarios[${rpc}] must be an array`).toBe(true);
    }
  });

  it('exactly 14 RPCs wired', () => {
    expect(Object.keys(aiLlmConformanceSuite.scenariosByRpc)).toHaveLength(14);
  });

  it('all scenario arrays are empty in v1 skeleton (until framework lands)', () => {
    for (const [rpc, scenarios] of Object.entries(aiLlmConformanceSuite.scenariosByRpc)) {
      expect(scenarios.length, `scenarios[${rpc}] should be empty in skeleton`).toBe(0);
    }
  });

  it('exports canonical capability registries for vendor module authors', () => {
    expect(AI_LLM_CANONICAL_RPCS).toEqual([
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
    ]);
    expect(AI_LLM_CANONICAL_EVENTS).toEqual([
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
    ]);
    expect(AI_LLM_INPUT_MODALITIES).toEqual(['text', 'image', 'audio', 'file']);
    expect(AI_LLM_REASONING_VISIBILITY).toEqual(['hidden', 'summary', 'full']);
    expect(AI_LLM_ASYNC_JOB_TYPES).toEqual(['BATCH_COMPLETION']);
    expect(AI_LLM_AGENT_EXECUTION_MODES).toEqual(['delegated', 'local', 'none']);
    expect(AI_LLM_CAPABILITY_FIELDS).toEqual([
      'vendors',
      'rpcs',
      'events',
      'input_modalities',
      'reasoning_visibility_supported',
      'thread',
      'async_job_types',
      'agent_execution_mode',
    ]);
  });
});
