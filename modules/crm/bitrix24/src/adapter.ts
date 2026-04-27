import { B24Hook } from '@bitrix24/b24jssdk';
import { mapBitrix24Error } from './errors.js';
import type { Bitrix24BatchCall, Bitrix24Record } from './types.js';

interface SdkResult {
  readonly isSuccess?: boolean;
  getData?(): unknown;
  getErrorMessages?(): string[];
}

export interface Bitrix24HookLike {
  readonly actions?: {
    readonly v2?: {
      readonly call?: {
        make(input: { method: string; params?: Bitrix24Record; requestId?: string }): Promise<SdkResult>;
      };
      readonly batchByChunk?: {
        make(input: { calls: readonly Bitrix24BatchCall[]; options?: { requestId?: string } }): Promise<SdkResult>;
      };
    };
  };
  callListMethod?(method: string, params?: Bitrix24Record): Promise<SdkResult>;
  fetchListMethod?(method: string, params?: Bitrix24Record, key?: string): AsyncIterable<unknown[]>;
  offClientSideWarning?(): void;
}

export interface CreateBitrix24AdapterOptions {
  readonly hook?: Bitrix24HookLike;
  readonly client?: Bitrix24HookLike;
  readonly webhookUrl?: string;
  readonly b24Url?: string;
  readonly userId?: number;
  readonly secret?: string;
}

export interface Bitrix24Adapter {
  call(method: string, params?: Bitrix24Record, requestId?: string, notFoundCode?: string): Promise<unknown>;
  list(method: string, params?: Bitrix24Record, requestId?: string, notFoundCode?: string): Promise<Bitrix24Record[]>;
  batch(calls: readonly Bitrix24BatchCall[], requestId?: string): Promise<unknown>;
}

export function createBitrix24Adapter(options: CreateBitrix24AdapterOptions = {}): Bitrix24Adapter {
  const hook = options.hook ?? options.client ?? createHook(options);
  hook.offClientSideWarning?.();

  return {
    call: async (method, params = {}, requestId, notFoundCode) => {
      try {
        const response = await hook.actions?.v2?.call?.make({ method, params, requestId });
        if (!response) throw new Error('Bitrix24 SDK hook does not expose actions.v2.call.make');
        return unwrapResult(response, notFoundCode);
      } catch (error) {
        throw mapBitrix24Error(error, notFoundCode);
      }
    },
    list: async (method, params = {}, requestId, notFoundCode) => {
      try {
        const explicitPage = usesExplicitPage(params);
        if (hook.callListMethod && !explicitPage) {
          return asRecords(unwrapResult(await hook.callListMethod(method, params), notFoundCode));
        }
        if (explicitPage) {
          const response = await hook.actions?.v2?.call?.make({ method, params, requestId });
          if (!response) throw new Error('Bitrix24 SDK hook does not expose actions.v2.call.make for paginated list calls');
          return asRecords(unwrapResult(response, notFoundCode));
        }
        if (hook.fetchListMethod) {
          const rows: Bitrix24Record[] = [];
          for await (const chunk of hook.fetchListMethod(method, params, 'ID')) {
            rows.push(...asRecords(chunk));
          }
          return rows;
        }
        const response = await hook.actions?.v2?.call?.make({ method, params });
        if (!response) throw new Error('Bitrix24 SDK hook does not expose a list method');
        return asRecords(unwrapResult(response, notFoundCode));
      } catch (error) {
        throw mapBitrix24Error(error, notFoundCode);
      }
    },
    batch: async (calls, requestId) => {
      try {
        const response = await hook.actions?.v2?.batchByChunk?.make(requestId ? { calls, options: { requestId } } : { calls });
        if (!response) throw new Error('Bitrix24 SDK hook does not expose actions.v2.batchByChunk.make');
        return unwrapResult(response);
      } catch (error) {
        throw mapBitrix24Error(error);
      }
    },
  };
}

function usesExplicitPage(params: Bitrix24Record): boolean {
  return 'start' in params || 'limit' in params;
}

export const createBitrix24SdkAdapter = createBitrix24Adapter;

function createHook(options: CreateBitrix24AdapterOptions): Bitrix24HookLike {
  if (options.webhookUrl ?? process.env.BITRIX24_WEBHOOK_URL) {
    return B24Hook.fromWebhookUrl((options.webhookUrl ?? process.env.BITRIX24_WEBHOOK_URL) as string) as unknown as Bitrix24HookLike;
  }
  if (options.b24Url && options.userId && options.secret) {
    return new B24Hook({ b24Url: options.b24Url, userId: options.userId, secret: options.secret }) as unknown as Bitrix24HookLike;
  }
  if (process.env.BITRIX24_URL && process.env.BITRIX24_USER_ID && process.env.BITRIX24_SECRET) {
    return new B24Hook({
      b24Url: process.env.BITRIX24_URL,
      userId: Number(process.env.BITRIX24_USER_ID),
      secret: process.env.BITRIX24_SECRET,
    }) as unknown as Bitrix24HookLike;
  }
  throw new Error('Bitrix24 adapter requires BITRIX24_WEBHOOK_URL or BITRIX24_URL/BITRIX24_USER_ID/BITRIX24_SECRET');
}

function unwrapResult(result: SdkResult, notFoundCode?: string): unknown {
  if (result.isSuccess === false) {
    const data = typeof result.getData === 'function' ? result.getData() : {};
    const messages = result.getErrorMessages?.() ?? [];
    throw mapBitrix24Error({ ...(isRecord(data) ? data : {}), message: messages.join('; ') }, notFoundCode);
  }
  const data = result.getData?.();
  if (isRecord(data) && ('error' in data || 'error_description' in data)) {
    throw mapBitrix24Error(data, notFoundCode);
  }
  if (isRecord(data) && 'result' in data) return data.result;
  return data;
}

function asRecords(value: unknown): Bitrix24Record[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.result)) return value.result.filter(isRecord);
  if (isRecord(value) && Array.isArray(value.items)) return value.items.filter(isRecord);
  return [];
}

function isRecord(value: unknown): value is Bitrix24Record {
  return typeof value === 'object' && value !== null;
}
