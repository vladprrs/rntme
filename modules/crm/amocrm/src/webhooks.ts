import type { AmoCrmAdapter } from './adapter.js';
import type { IdempotencyStore } from './types.js';

export interface AmoCrmWebhookReceiver {
  handle(request: Request): Promise<Response>;
}

export interface CreateAmoCrmWebhookReceiverOptions {
  readonly adapter: AmoCrmAdapter;
  readonly dedupeStore: IdempotencyStore;
}

export function createAmoCrmWebhookReceiver(_options: CreateAmoCrmWebhookReceiverOptions): AmoCrmWebhookReceiver {
  return {
    handle: async (request) => {
      const body = await request.text();
      const params = new URLSearchParams(body);
      const accountId = params.get('account[id]');
      const accountSubdomain = params.get('account[subdomain]');

      const events: Array<{ type: string; payload: unknown }> = [];

      for (const [key, value] of params.entries()) {
        const match = key.match(/^(\w+)\[(\w+)\]\[(\d+)\]\[(\w+)\]$/);
        if (match) {
          const [, entityType, action] = match;
          events.push({
            type: `rntme.crm.v1.${capitalize(entityType.slice(0, -1))}${capitalize(action)}`,
            payload: { entityType: entityType.slice(0, -1), action, accountId, accountSubdomain, value },
          });
        }
      }

      return new Response(JSON.stringify({ received: events.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private store = new Map<string, number>();

  async get(key: string): Promise<boolean> {
    const expiresAt = this.store.get(key);
    if (expiresAt === undefined) return false;
    if (Date.now() > expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async set(key: string, ttlMs: number): Promise<void> {
    this.store.set(key, Date.now() + ttlMs);
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
