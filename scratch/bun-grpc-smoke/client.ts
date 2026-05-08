import * as grpc from '@grpc/grpc-js';

const client = new grpc.Client('localhost:50099', grpc.credentials.createInsecure());
const path = '/smoke.Smoke/Ping';
const out = await new Promise<Buffer>((resolve, reject) => {
  client.makeUnaryRequest(
    path,
    (v: Buffer) => v,
    (b: Buffer) => b,
    Buffer.from('hello', 'utf8'),
    (err, response) => (err ? reject(err) : resolve(response!)),
  );
});
console.log('reply:', out.toString('utf8'));
client.close();
process.exit(0);
