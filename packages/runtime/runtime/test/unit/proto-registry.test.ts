import { describe, it, expect } from 'bun:test';
import { ProtoRegistry } from '../../src/plugins/adapter-client/proto-registry.js';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
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

  it('loads proto imports relative to the module proto file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-proto-imports-'));
    mkdirSync(join(dir, 'common'), { recursive: true });
    writeFileSync(join(dir, 'common', 'shared.proto'), `
syntax = "proto3";
package rntme.shared.v1;
message Ref { string id = 1; }
`);
    writeFileSync(join(dir, 'identity.proto'), `
syntax = "proto3";
package rntme.identity.v1;
import "common/shared.proto";
message IntrospectRequest { string token = 1; }
message Session { rntme.shared.v1.Ref ref = 1; string user_id = 2; }
service IdentityModule {
  rpc Introspect (IntrospectRequest) returns (Session);
}
`);

    const registry = new ProtoRegistry();
    registry.registerModule('identity', join(dir, 'identity.proto'));

    const method = registry.getMethodDescriptors('identity').Introspect;
    expect(method).toBeDefined();
    expect(method!.path).toBe('/rntme.identity.v1.IdentityModule/Introspect');
    const encoded = method!.responseSerialize({ ref: { id: 'ref-1' }, user_id: 'user-1' });
    expect(method!.responseDeserialize(encoded)).toMatchObject({ user_id: 'user-1' });
  });
});
