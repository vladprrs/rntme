import { describe, expect, it } from 'vitest';
import { loadWorkerConfigFromEnv } from '../../src/env.js';

describe('loadWorkerConfigFromEnv', () => {
  it('loads worker config from rendered Dokploy env', () => {
    const config = loadWorkerConfigFromEnv({
      RNTME_EVENT_BUS_BROKERS: 'redpanda:9092',
      RNTME_EVENT_BUS_PROTOCOL: 'plaintext',
      RNTME_OPERATON_BASE_URL: 'http://operaton:8080/engine-rest',
      RNTME_WORKFLOWS_MANIFEST_PATH: '/srv/workflows/workflows.json',
      RNTME_WORKFLOW_SERVICE_ENDPOINTS_JSON: '{"inventory.reserveStock":"inventory:50051"}',
      RNTME_WORKFLOW_GRPC_SERVICES_JSON: '{"inventory":{"packageName":"rntme.inventory.v1","serviceName":"InventoryService","protoSource":"syntax = \\"proto3\\";"}}',
      RNTME_WORKFLOW_SUBSCRIPTIONS_JSON: '[{"messageStartId":"orderPlaced","topic":"rntme.orders.order","service":"orders","aggregateType":"Order","eventType":"OrderPlaced","processId":"orderFulfillment","messageName":"OrderPlaced","businessKey":"$event.data.orderId"}]',
    });

    expect(config.eventBusBrokers).toEqual(['redpanda:9092']);
    expect(config.workflowServiceEndpoints).toEqual({ 'inventory.reserveStock': 'inventory:50051' });
    expect(config.workflowGrpcServices?.inventory?.serviceName).toBe('InventoryService');
    expect(config.workflowSubscriptions[0]?.eventType).toBe('OrderPlaced');
  });

  it('throws a stable message when required env is missing', () => {
    expect(() => loadWorkerConfigFromEnv({})).toThrow('BPMN_WORKER_ENV_MISSING: RNTME_EVENT_BUS_BROKERS');
  });
});
