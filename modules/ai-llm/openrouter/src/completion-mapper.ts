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
