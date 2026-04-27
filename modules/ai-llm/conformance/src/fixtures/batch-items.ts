/**
 * BatchCompletionItem fixtures. Each carries a small canonical CreateCompletionRequest.
 * The vendor model is intentionally left as a placeholder that scenarios can override
 * (since vendor-prefix is module-specific).
 */

import { systemHelpful, userMath, userHello } from './messages.js';

export const tinyBatch = (vendorPrefix: string) => ({
  completion_window: '24h',
  items: [
    {
      custom_id: 'req_001',
      request: {
        context: {
          idempotency_key: 'batch-001',
          correlation_id: 'corr-batch-001',
          actor_user_id: 'system',
          actor_type: 'system',
        },
        model: `${vendorPrefix}/<smallest-model>`,
        messages: [systemHelpful, userMath],
      },
    },
    {
      custom_id: 'req_002',
      request: {
        context: {
          idempotency_key: 'batch-002',
          correlation_id: 'corr-batch-002',
          actor_user_id: 'system',
          actor_type: 'system',
        },
        model: `${vendorPrefix}/<smallest-model>`,
        messages: [userHello],
      },
    },
  ],
});

export const oversizedBatch = (vendorPrefix: string) => ({
  completion_window: '24h',
  items: Array.from({ length: 60_000 }, (_, i) => ({
    custom_id: `req_${i}`,
    request: {
      context: {
        idempotency_key: `oversize-${i}`,
        correlation_id: `corr-oversize-${i}`,
        actor_user_id: 'system',
        actor_type: 'system',
      },
      model: `${vendorPrefix}/<smallest-model>`,
      messages: [userHello],
    },
  })),
});
