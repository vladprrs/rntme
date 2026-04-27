/**
 * Canonical AI/LLM v1 capability universe. Vendor modules declare subsets of
 * these values in module.json#capabilities; the future conformance runner uses
 * the same lists for skip/report labelling.
 */

export const AI_LLM_CANONICAL_RPCS = [
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

export const AI_LLM_CANONICAL_EVENTS = [
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

export const AI_LLM_INPUT_MODALITIES = ['text', 'image', 'audio', 'file'] as const;
export const AI_LLM_REASONING_VISIBILITY = ['hidden', 'summary', 'full'] as const;
export const AI_LLM_ASYNC_JOB_TYPES = ['BATCH_COMPLETION'] as const;
export const AI_LLM_AGENT_EXECUTION_MODES = ['delegated', 'local', 'none'] as const;

export const AI_LLM_CAPABILITY_FIELDS = [
  'vendors',
  'rpcs',
  'events',
  'input_modalities',
  'reasoning_visibility_supported',
  'thread',
  'async_job_types',
  'agent_execution_mode',
] as const;
