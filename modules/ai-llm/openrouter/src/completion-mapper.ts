import { Buffer } from 'node:buffer';
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
  tool_choice?: string;
  sampling?: ProtoSamplingParams;
  reasoningEffort?: number;
  reasoning_effort?: number;
  reasoningVisibility?: number;
  reasoning_visibility?: number;
  metadata?: Record<string, unknown>;
}

interface ProtoMessage {
  role?: string;
  content?: ProtoContentBlock[];
}

interface ProtoContentBlock {
  type?: number;
  text?: { text?: string };
  image?: { url?: string; base64Data?: string | Uint8Array; base64_data?: string | Uint8Array; mediaType?: string; media_type?: string };
  file?: { url?: string; base64Data?: string | Uint8Array; base64_data?: string | Uint8Array; vendorFileId?: string; vendor_file_id?: string; mediaType?: string; media_type?: string; filename?: string };
  toolUse?: ProtoToolCallBlock;
  tool_use?: ProtoToolCallBlock;
  toolResult?: ProtoToolResultBlock;
  tool_result?: ProtoToolResultBlock;
  thinking?: { text?: string; redacted?: boolean };
}

interface ProtoSamplingParams {
  temperature?: number;
  topP?: number;
  top_p?: number;
  topK?: number;
  top_k?: number;
  maxTokens?: number;
  max_tokens?: number;
  frequencyPenalty?: number;
  frequency_penalty?: number;
  presencePenalty?: number;
  presence_penalty?: number;
  stopSequences?: string[];
  stop_sequences?: string[];
  seed?: number;
  responseFormat?: string;
  response_format?: string;
  responseSchema?: unknown;
  response_schema?: unknown;
}

interface ProtoToolDefinition {
  name?: string;
  description?: string;
  inputSchema?: unknown;
  input_schema?: unknown;
  strict?: boolean;
}

interface ProtoToolCallBlock {
  id?: string;
  name?: string;
  arguments?: unknown;
}

interface ProtoToolResultBlock {
  toolCallId?: string;
  tool_call_id?: string;
  output?: unknown;
  isError?: boolean;
  is_error?: boolean;
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

function firstDefined<T>(...values: Array<T | undefined>): T | undefined {
  return values.find((value) => value !== undefined);
}

function toBase64String(value: string | Uint8Array | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return Buffer.from(value).toString('base64');
}

function protoStructToJson(value: unknown): unknown {
  if (!isProtoStruct(value)) return value;
  return Object.fromEntries(
    Object.entries(value.fields).map(([key, protoValue]) => [key, protoValueToJson(protoValue)]),
  );
}

function isProtoStruct(value: unknown): value is { fields: Record<string, Record<string, unknown>> } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'fields' in value &&
    (value as { fields?: unknown }).fields !== null &&
    typeof (value as { fields?: unknown }).fields === 'object' &&
    !Array.isArray((value as { fields?: unknown }).fields)
  );
}

function protoValueToJson(value: Record<string, unknown>): unknown {
  if ('stringValue' in value) return value.stringValue;
  if ('string_value' in value) return value.string_value;
  if ('numberValue' in value) return value.numberValue;
  if ('number_value' in value) return value.number_value;
  if ('boolValue' in value) return value.boolValue;
  if ('bool_value' in value) return value.bool_value;
  if ('nullValue' in value || 'null_value' in value) return null;
  const structValue = firstDefined(value.structValue, value.struct_value);
  if (isProtoStruct(structValue)) return protoStructToJson(structValue);
  const listValue = firstDefined(value.listValue, value.list_value) as { values?: unknown[] } | undefined;
  if (listValue && Array.isArray(listValue.values)) {
    return listValue.values.map((item) =>
      item !== null && typeof item === 'object'
        ? protoValueToJson(item as Record<string, unknown>)
        : item,
    );
  }
  return null;
}

function blockToOrPart(block: ProtoContentBlock): unknown {
  switch (block.type) {
    case ContentBlockType.TEXT:
      return { type: 'text', text: block.text?.text ?? '' };
    case ContentBlockType.IMAGE: {
      const img = block.image ?? {};
      const base64Data = toBase64String(firstDefined(img.base64Data, img.base64_data));
      const mediaType = firstDefined(img.mediaType, img.media_type) ?? 'image/png';
      const url = base64Data ? `data:${mediaType};base64,${base64Data}` : img.url;
      if (!url) throw new AiLlmOpenRouterError('image block has no url or base64Data', GrpcStatus.INVALID_ARGUMENT, 'AI_LLM_STRUCTURAL_INVALID_MEDIA_REFERENCE');
      return { type: 'image_url', image_url: { url } };
    }
    case ContentBlockType.FILE: {
      const f = block.file ?? {};
      const base64Data = toBase64String(firstDefined(f.base64Data, f.base64_data));
      const mediaType = firstDefined(f.mediaType, f.media_type) ?? 'application/octet-stream';
      const fileData =
        base64Data !== undefined
          ? `data:${mediaType};base64,${base64Data}`
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
    .filter((b) => b.type === ContentBlockType.TOOL_USE && firstDefined(b.toolUse, b.tool_use) !== undefined)
    .map((b) => {
      const toolUse = firstDefined(b.toolUse, b.tool_use)!;
      return {
        id: toolUse.id ?? '',
        type: 'function',
        function: { name: toolUse.name ?? '', arguments: JSON.stringify(toolUse.arguments ?? {}) },
      };
    });

  if (role === 'tool') {
    const tr = firstDefined(
      blocks.find((b) => b.type === ContentBlockType.TOOL_RESULT)?.toolResult,
      blocks.find((b) => b.type === ContentBlockType.TOOL_RESULT)?.tool_result,
    );
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
    const topP = firstDefined(s.topP, s.top_p);
    if (topP !== undefined) result.top_p = topP;
    const maxTokens = firstDefined(s.maxTokens, s.max_tokens);
    if (maxTokens !== undefined) result.max_tokens = maxTokens;
    const frequencyPenalty = firstDefined(s.frequencyPenalty, s.frequency_penalty);
    if (frequencyPenalty !== undefined) result.frequency_penalty = frequencyPenalty;
    const presencePenalty = firstDefined(s.presencePenalty, s.presence_penalty);
    if (presencePenalty !== undefined) result.presence_penalty = presencePenalty;
    const stopSequences = firstDefined(s.stopSequences, s.stop_sequences);
    if (stopSequences && stopSequences.length > 0) result.stop = stopSequences;
    if (s.seed !== undefined) result.seed = s.seed;
    const responseFormat = firstDefined(s.responseFormat, s.response_format);
    const responseSchema = firstDefined(s.responseSchema, s.response_schema);
    if (responseFormat === 'json_schema') {
      if (responseSchema === undefined) {
        throw new AiLlmOpenRouterError(
          'response_format=json_schema requires response_schema',
          GrpcStatus.INVALID_ARGUMENT,
          'AI_LLM_STRUCTURAL_INVALID_SAMPLING_PARAMS',
        );
      }
      result.response_format = { type: 'json_schema', json_schema: { name: 'schema', schema: protoStructToJson(responseSchema), strict: true } };
    } else if (responseFormat === 'json_object') {
      result.response_format = { type: 'json_object' };
    }
  }

  if (proto.tools && proto.tools.length > 0) {
    result.tools = proto.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name ?? '',
        description: t.description ?? '',
        parameters: protoStructToJson(firstDefined(t.inputSchema, t.input_schema)) ?? { type: 'object', properties: {} },
      },
    }));
    const toolChoice = firstDefined(proto.toolChoice, proto.tool_choice);
    if (toolChoice) result.tool_choice = toolChoice;
  }

  const reasoningEffort = firstDefined(proto.reasoningEffort, proto.reasoning_effort);
  if (reasoningEffort !== undefined) {
    const effort = ReasoningEffortMap[reasoningEffort];
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
