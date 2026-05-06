import { AiLlmOpenRouterError, GrpcStatus } from './errors.js';

const VENDOR_PREFIX = 'openrouter';

const ContentBlockType = {
  TEXT: 1,
  IMAGE: 2,
  AUDIO: 3,
  FILE: 4,
  TOOL_USE: 5,
  TOOL_RESULT: 6,
  THINKING: 7,
} as const;

interface ProtoCompletionRequest {
  model?: string;
  messages?: ProtoMessage[];
  tools?: ProtoToolDefinition[];
  toolChoice?: string;
  sampling?: ProtoSamplingParams;
  reasoningEffort?: number;
  reasoningVisibility?: number;
  metadata?: Record<string, unknown>;
}

interface ProtoMessage {
  role?: string;
  content?: ProtoContentBlock[];
}

interface ProtoContentBlock {
  type?: number;
  text?: { text?: string };
  image?: { url?: string; base64Data?: string; mediaType?: string };
  file?: { url?: string; base64Data?: string; vendorFileId?: string; mediaType?: string; filename?: string };
  toolUse?: { id?: string; name?: string; arguments?: unknown };
  toolResult?: { toolCallId?: string; output?: unknown; isError?: boolean };
  thinking?: { text?: string; redacted?: boolean };
}

interface ProtoSamplingParams {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  seed?: number;
  responseFormat?: string;
  responseSchema?: unknown;
}

interface ProtoToolDefinition {
  name?: string;
  description?: string;
  inputSchema?: unknown;
  strict?: boolean;
}

export interface OrChatCompletionRequest {
  model: string;
  messages: { role: string; content: unknown }[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  seed?: number;
  response_format?: unknown;
  tools?: unknown[];
  tool_choice?: string;
  reasoning?: { effort?: string };
}

const ReasoningEffortMap: Record<number, string | undefined> = {
  0: undefined,    // UNSPECIFIED
  1: 'low',        // MINIMAL
  2: 'low',        // LOW
  3: 'medium',     // MEDIUM
  4: 'high',       // HIGH
  5: 'high',       // MAX
};

function stripVendorPrefix(model: string): string {
  if (!model.startsWith(`${VENDOR_PREFIX}/`)) {
    throw new AiLlmOpenRouterError(
      `vendor mismatch: model "${model}" must start with "${VENDOR_PREFIX}/"`,
      GrpcStatus.INVALID_ARGUMENT,
      'AI_LLM_STRUCTURAL_VENDOR_MISMATCH',
    );
  }
  return model.slice(VENDOR_PREFIX.length + 1);
}

function blockToOrPart(block: ProtoContentBlock): unknown {
  switch (block.type) {
    case ContentBlockType.TEXT:
      return { type: 'text', text: block.text?.text ?? '' };
    case ContentBlockType.IMAGE: {
      const img = block.image ?? {};
      const url = img.base64Data ? `data:${img.mediaType ?? 'image/png'};base64,${img.base64Data}` : img.url;
      if (!url) throw new AiLlmOpenRouterError('image block has no url or base64Data', GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_INVALID_MEDIA_REFERENCE');
      return { type: 'image_url', image_url: { url } };
    }
    case ContentBlockType.FILE: {
      const f = block.file ?? {};
      const fileData =
        f.base64Data !== undefined
          ? `data:${f.mediaType ?? 'application/octet-stream'};base64,${f.base64Data}`
          : f.url;
      if (!fileData)
        throw new AiLlmOpenRouterError(
          'file block has no url or base64Data (vendor_file_id not supported by openrouter)',
          GrpcStatus.INVALID_ARGUMENT,
          'AI_LLM_STRUCTURAL_INVALID_MEDIA_REFERENCE',
        );
      return { type: 'file', file: { filename: f.filename ?? 'file', file_data: fileData } };
    }
    case ContentBlockType.TOOL_USE: {
      // Lifted to the message-level tool_calls array by the caller.
      return null;
    }
    case ContentBlockType.TOOL_RESULT: {
      // Lifted to message content as a JSON-stringified value.
      return null;
    }
    case ContentBlockType.THINKING:
      // Thinking blocks are read-only output; not sent to OR.
      return null;
    default:
      throw new AiLlmOpenRouterError(`unsupported content block type ${block.type}`, GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_INVALID_CONTENT_BLOCK');
  }
}

function messageToOr(msg: ProtoMessage): { role: string; content: unknown; tool_calls?: unknown[] } {
  const role = msg.role ?? 'user';
  const blocks = msg.content ?? [];

  const toolCalls = blocks
    .filter((b) => b.type === ContentBlockType.TOOL_USE && b.toolUse !== undefined)
    .map((b) => ({
      id: b.toolUse!.id ?? '',
      type: 'function',
      function: { name: b.toolUse!.name ?? '', arguments: JSON.stringify(b.toolUse!.arguments ?? {}) },
    }));

  if (role === 'tool') {
    const tr = blocks.find((b) => b.type === ContentBlockType.TOOL_RESULT)?.toolResult;
    return { role: 'tool', content: JSON.stringify(tr?.output ?? null) };
  }

  const parts = blocks.map(blockToOrPart).filter((p): p is object => p !== null);
  const result: { role: string; content: unknown; tool_calls?: unknown[] } = { role, content: parts };
  if (toolCalls.length > 0) result.tool_calls = toolCalls;
  return result;
}

export function buildOpenRouterRequest(proto: ProtoCompletionRequest): OrChatCompletionRequest {
  if (!proto.model) {
    throw new AiLlmOpenRouterError('model is required', GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_MISSING_MODEL');
  }
  if (!proto.messages || proto.messages.length === 0) {
    throw new AiLlmOpenRouterError('messages must be non-empty', GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_EMPTY_MESSAGES');
  }
  const result: OrChatCompletionRequest = {
    model: stripVendorPrefix(proto.model),
    messages: proto.messages.map(messageToOr),
  };

  const s = proto.sampling;
  if (s) {
    if (s.temperature !== undefined) result.temperature = s.temperature;
    if (s.topP !== undefined) result.top_p = s.topP;
    if (s.maxTokens !== undefined) result.max_tokens = s.maxTokens;
    if (s.frequencyPenalty !== undefined) result.frequency_penalty = s.frequencyPenalty;
    if (s.presencePenalty !== undefined) result.presence_penalty = s.presencePenalty;
    if (s.stopSequences && s.stopSequences.length > 0) result.stop = s.stopSequences;
    if (s.seed !== undefined) result.seed = s.seed;
    if (s.responseFormat === 'json_schema') {
      if (s.responseSchema === undefined) {
        throw new AiLlmOpenRouterError(
          'response_format=json_schema requires response_schema',
          GrpcStatus.INVALID_ARGUMENT,
          'AI_LLM_STRUCTURAL_INVALID_SAMPLING_PARAMS',
        );
      }
      result.response_format = { type: 'json_schema', json_schema: { name: 'schema', schema: s.responseSchema, strict: true } };
    } else if (s.responseFormat === 'json_object') {
      result.response_format = { type: 'json_object' };
    }
  }

  if (proto.tools && proto.tools.length > 0) {
    result.tools = proto.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name ?? '',
        description: t.description ?? '',
        parameters: t.inputSchema ?? { type: 'object', properties: {} },
      },
    }));
    if (proto.toolChoice) result.tool_choice = proto.toolChoice;
  }

  if (proto.reasoningEffort !== undefined) {
    const effort = ReasoningEffortMap[proto.reasoningEffort];
    if (effort) result.reasoning = { effort };
  }

  return result;
}

export interface ParseRequestContext {
  model: string;
  idempotencyKey: string;
  requestStartedAt: Date;
}

interface OrChoice {
  message?: {
    role?: string;
    content?: string | null;
    reasoning?: string | null;
    reasoning_details?: unknown;
    tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
  };
  finish_reason?: string;
}

interface OrUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
  cost?: number;
}

interface OrResponse {
  id?: string;
  model?: string;
  choices?: OrChoice[];
  usage?: OrUsage;
}

const FinishReasonMap: Record<string, number> = {
  stop: 1,
  length: 2,
  tool_calls: 3,
  content_filter: 4,
  error: 5,
};

interface ProtoStruct { fields: Record<string, ProtoValue> }
interface ProtoValue {
  null_value?: number;
  number_value?: number;
  string_value?: string;
  bool_value?: boolean;
  struct_value?: ProtoStruct;
  list_value?: { values: ProtoValue[] };
}

function toProtoValue(v: unknown): ProtoValue {
  if (v === null || v === undefined) return { null_value: 0 };
  if (typeof v === 'string') return { string_value: v };
  if (typeof v === 'number') return Number.isFinite(v) ? { number_value: v } : { string_value: String(v) };
  if (typeof v === 'boolean') return { bool_value: v };
  if (Array.isArray(v)) return { list_value: { values: v.map(toProtoValue) } };
  if (typeof v === 'object') return { struct_value: toProtoStruct(v as Record<string, unknown>) };
  return { string_value: String(v) };
}

function toProtoStruct(obj: Record<string, unknown>): ProtoStruct {
  return {
    fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toProtoValue(v)])),
  };
}

function toProtoTimestamp(d: Date): { seconds: number; nanos: number } {
  const ms = d.getTime();
  return { seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1_000_000 };
}

interface ProtoToolCall { id: string; name: string; arguments?: ProtoStruct }

interface ProtoContentBlockOut {
  type: number;
  text?: { text: string };
  tool_use?: ProtoToolCall;
  thinking?: { text: string; redacted: boolean };
}

export interface MappedCompletion {
  ref: { canonical_id: string };
  model: string;
  content: ProtoContentBlockOut[];
  finish_reason: number;
  usage: { input_tokens: number; output_tokens: number; total_tokens: number; reasoning_tokens: number; cached_tokens: number };
  tool_calls?: ProtoToolCall[];
  started_at: { seconds: number; nanos: number };
  finished_at: { seconds: number; nanos: number };
  vendor_raw: ProtoStruct;
}

export function parseOpenRouterResponse(or: OrResponse, ctx: ParseRequestContext): MappedCompletion {
  const choice = or.choices?.[0];
  if (!choice) {
    throw new AiLlmOpenRouterError('OR returned no choices', GrpcStatus.INTERNAL, 'AI_LLM_VENDOR_UNAVAILABLE');
  }

  const content: ProtoContentBlockOut[] = [];
  if (typeof choice.message?.content === 'string' && choice.message.content.length > 0) {
    content.push({ type: 1, text: { text: choice.message.content } });
  }
  if (choice.message?.reasoning) {
    content.push({ type: 7, thinking: { text: choice.message.reasoning, redacted: false } });
  }

  const toolCalls: ProtoToolCall[] =
    choice.message?.tool_calls?.map((tc) => {
      const parsed = tc.function?.arguments ? safeJson(tc.function.arguments) : {};
      const args =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? toProtoStruct(parsed as Record<string, unknown>)
          : toProtoStruct({ value: parsed });
      return { id: tc.id ?? '', name: tc.function?.name ?? '', arguments: args };
    }) ?? [];

  for (const tc of toolCalls) {
    content.push({ type: 5, tool_use: tc });
  }

  const u = or.usage ?? {};
  const usage = {
    input_tokens: u.prompt_tokens ?? 0,
    output_tokens: u.completion_tokens ?? 0,
    total_tokens: u.total_tokens ?? 0,
    reasoning_tokens: u.reasoning_tokens ?? 0,
    cached_tokens: u.cached_tokens ?? 0,
  };

  const vendorRaw: Record<string, unknown> = {};
  if (u.cost !== undefined) vendorRaw.cost_usd = u.cost;
  if (or.id) vendorRaw.openrouter_id = or.id;
  if (or.model) vendorRaw.openrouter_model = or.model;

  const completion: MappedCompletion = {
    ref: { canonical_id: ctx.idempotencyKey },
    model: ctx.model,
    content,
    finish_reason: FinishReasonMap[choice.finish_reason ?? ''] ?? 0,
    usage,
    started_at: toProtoTimestamp(ctx.requestStartedAt),
    finished_at: toProtoTimestamp(new Date()),
    vendor_raw: toProtoStruct(vendorRaw),
  };
  if (toolCalls.length > 0) completion.tool_calls = toolCalls;
  return completion;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
