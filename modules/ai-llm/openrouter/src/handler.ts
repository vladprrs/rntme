import { proto } from '@rntme/contracts-ai-llm-v1';
import { Buffer } from 'node:buffer';
import { AiLlmOpenRouterError, GrpcStatus, unimplemented } from './errors.js';
import { mapOpenRouterError } from './error-mapper.js';
import { buildOpenRouterRequest, parseOpenRouterResponse } from './completion-mapper.js';
import { OpenRouterClient } from './openrouter-client.js';
import type { IdempotencyStore } from './idempotency-store.js';

const CompletionMessage = proto.rntme.contracts.ai_llm.v1.Completion;

export interface ModuleBus {
  emit(type: string, data: unknown): Promise<void>;
}

export interface CreateOpenRouterModuleOptions {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  store: IdempotencyStore;
  bus: ModuleBus;
  now: () => number;
  httpReferer?: string;
  xTitle?: string;
}

type Handler = (req: object) => Promise<object>;

export function createOpenRouterModule(opts: CreateOpenRouterModuleOptions): Partial<Record<string, Handler>> {
  const client = new OpenRouterClient({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl,
    fetch: opts.fetch,
    httpReferer: opts.httpReferer,
    xTitle: opts.xTitle,
  });

  async function Complete(req: object): Promise<object> {
    const r = req as { context?: { idempotencyKey?: string; correlationId?: string }; model?: string };
    const idempotencyKey = r.context?.idempotencyKey;
    if (!idempotencyKey || idempotencyKey.length === 0) {
      throw new AiLlmOpenRouterError(
        'idempotency_key is required',
        GrpcStatus.INVALID_ARGUMENT,
        'AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY',
      );
    }

    const cached = await opts.store.get(idempotencyKey);
    if (cached) {
      const completion = (CompletionMessage as {
        decode: (b: Uint8Array) => object;
        toObject: (m: object, options?: object) => object;
      }).toObject(
        (CompletionMessage as { decode: (b: Uint8Array) => object }).decode(cached),
        { defaults: true },
      );
      return completion;
    }

    await opts.bus.emit('CompletionStarted', {
      canonicalId: idempotencyKey,
      correlationId: r.context?.correlationId,
    });

    let orResponse: unknown;
    try {
      orResponse = await client.chatCompletions(
        buildOpenRouterRequest(r as Parameters<typeof buildOpenRouterRequest>[0]),
      );
    } catch (e) {
      const env = e as {
        httpStatus?: number;
        orError?: { code?: string; message?: string };
        networkError?: unknown;
      };
      if ('httpStatus' in env || 'networkError' in env) {
        const mapped = mapOpenRouterError(env);
        await opts.bus.emit('CompletionFailed', {
          canonicalId: idempotencyKey,
          code: mapped.aiLlmCode,
          message: mapped.message,
        });
        throw mapped;
      }
      // Re-throw structural/contract errors from the mapper itself (already AiLlmOpenRouterError).
      if (e instanceof AiLlmOpenRouterError) {
        await opts.bus.emit('CompletionFailed', {
          canonicalId: idempotencyKey,
          code: e.aiLlmCode,
          message: e.message,
        });
      }
      throw e;
    }

    const completion = parseOpenRouterResponse(
      orResponse as Parameters<typeof parseOpenRouterResponse>[0],
      {
        model: r.model ?? '',
        idempotencyKey,
        requestStartedAt: new Date(opts.now()),
      },
    );

    const protoMsg = (CompletionMessage as {
      fromObject: (v: object) => object;
      encode: (m: object) => { finish: () => Uint8Array };
    }).encode(
      (CompletionMessage as { fromObject: (v: object) => object }).fromObject(completion as unknown as object),
    );
    await opts.store.put(idempotencyKey, Buffer.from(protoMsg.finish()));

    await opts.bus.emit('CompletionFinished', {
      canonicalId: idempotencyKey,
      finishReason: completion.finishReason,
    });
    return completion as unknown as object;
  }

  async function GetCompletion(req: object): Promise<object> {
    const id = (req as { canonicalId?: string }).canonicalId ?? '';
    const cached = await opts.store.get(id);
    if (!cached) {
      throw new AiLlmOpenRouterError(
        `completion ${id} not found`,
        GrpcStatus.NOT_FOUND,
        'AI_LLM_REFERENCES_COMPLETION_NOT_FOUND',
      );
    }
    const decoded = (CompletionMessage as {
      decode: (b: Uint8Array) => object;
      toObject: (m: object, options?: object) => object;
    }).toObject(
      (CompletionMessage as { decode: (b: Uint8Array) => object }).decode(cached),
      { defaults: true },
    );
    return decoded;
  }

  const unimplementedRpcs = [
    'CreateThread', 'GetThread', 'DeleteThread', 'AddMessage', 'ListThreadItems',
    'RunThread', 'GetThreadRun', 'CancelThreadRun',
    'SubmitJob', 'GetJob', 'CancelJob', 'ListJobs',
  ];
  const module: Record<string, Handler> = { Complete, GetCompletion };
  for (const name of unimplementedRpcs) {
    module[name] = async (): Promise<object> => {
      throw unimplemented(name);
    };
  }
  return module;
}
