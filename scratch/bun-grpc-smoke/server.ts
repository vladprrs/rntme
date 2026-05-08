import * as grpc from '@grpc/grpc-js';

const service: grpc.ServiceDefinition = {
  Ping: {
    path: '/smoke.Smoke/Ping',
    requestStream: false,
    responseStream: false,
    requestSerialize: (v: { msg: string }) => Buffer.from(v.msg, 'utf8'),
    requestDeserialize: (b: Buffer) => ({ msg: b.toString('utf8') }),
    responseSerialize: (v: { msg: string }) => Buffer.from(v.msg, 'utf8'),
    responseDeserialize: (b: Buffer) => ({ msg: b.toString('utf8') }),
  },
};

const server = new grpc.Server();
server.addService(service, {
  Ping: (
    call: grpc.ServerUnaryCall<{ msg: string }, { msg: string }>,
    cb: grpc.sendUnaryData<{ msg: string }>,
  ) => {
    cb(null, { msg: `pong:${call.request.msg}` });
  },
});

server.bindAsync('0.0.0.0:50099', grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err !== null) throw err;
  console.log(`bun-grpc smoke server listening on :${port}`);
});
