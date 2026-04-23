// demo/pre-step-demo/src/fake-payments-module.ts
import * as grpc from '@grpc/grpc-js';
import * as protobuf from 'protobufjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function startFakePayments(address: string, protoPath: string): Promise<() => Promise<void>> {
  const src = readFileSync(resolve(protoPath), 'utf8');
  const { root } = protobuf.parse(src, { keepCase: true });
  const svc = root.lookupService('rntme.payments.v1.PaymentsModule');
  const req = root.lookupType('rntme.payments.v1.GetOrCreateCustomerReq');
  const res = root.lookupType('rntme.payments.v1.GetOrCreateCustomerRes');

  const def: grpc.ServiceDefinition = {
    GetOrCreateCustomer: {
      path: '/rntme.payments.v1.PaymentsModule/GetOrCreateCustomer',
      requestStream: false,
      responseStream: false,
      requestSerialize: (v: object): Buffer => Buffer.from(req.encode(req.fromObject(v)).finish()),
      requestDeserialize: (b: Buffer): object => req.toObject(req.decode(b)),
      responseSerialize: (v: object): Buffer => Buffer.from(res.encode(res.fromObject(v)).finish()),
      responseDeserialize: (b: Buffer): object => res.toObject(res.decode(b)),
    },
  };

  const server = new grpc.Server();
  server.addService(def, {
    GetOrCreateCustomer: (call: grpc.ServerUnaryCall<{ user_id: string }, object>, cb: grpc.sendUnaryData<object>) => {
      const idem = call.metadata.get('rntme-idempotency-key').join(',');
      cb(null, { customerId: `cust-${call.request.user_id}` });
    },
  } as unknown as grpc.UntypedServiceImplementation);

  await new Promise<void>((resolveP, reject) => {
    const [host, port] = address.split(':');
    server.bindAsync(`${host}:${port}`, grpc.ServerCredentials.createInsecure(), (err) => {
      if (err !== null) reject(err);
      else resolveP();
    });
  });

  return async (): Promise<void> => new Promise((r) => server.tryShutdown(() => r()));
}
