import { describe, it, expect } from 'vitest';
import { ProtoRegistry } from '../../src/plugins/adapter-client/proto-registry.js';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SAMPLE_PROTO = `
syntax = "proto3";
package rntme.payments.v1;
message CreateCheckoutSessionRequest { string customer_id = 1; int64 amount = 2; }
message CreateCheckoutSessionResponse { string url = 1; string session_id = 2; }
service PaymentsModule {
  rpc CreateCheckoutSession (CreateCheckoutSessionRequest) returns (CreateCheckoutSessionResponse);
}
`;

describe('ProtoRegistry', () => {
  it('loads a proto file and resolves request/response types by service + rpc', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-proto-'));
    const path = join(dir, 'payments.proto');
    writeFileSync(path, SAMPLE_PROTO);
    const registry = new ProtoRegistry();
    registry.registerModule('payments', path);
    const methods = registry.getMethodDescriptors('payments');
    expect(methods.CreateCheckoutSession).toBeDefined();
    expect(methods.CreateCheckoutSession!.path).toBe('/rntme.payments.v1.PaymentsModule/CreateCheckoutSession');
  });

  it('throws when an unknown module is queried', () => {
    const reg = new ProtoRegistry();
    expect(() => reg.getMethodDescriptors('unknown')).toThrow(/not registered/);
  });
});
