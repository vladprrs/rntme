import { createAuth0Adapter } from '../adapter.js';
import { createAuth0IdentityModule } from '../handlers.js';
import { createIdentityAuth0GrpcServer } from '../server.js';

function readPort(): number {
  const raw = process.env.PORT ?? process.env.GRPC_PORT ?? '50051';
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid PORT/GRPC_PORT value: ${raw}`);
  }
  return port;
}

const adapter = createAuth0Adapter();
const module = createAuth0IdentityModule(adapter);
const server = createIdentityAuth0GrpcServer({
  module,
  port: readPort(),
  host: process.env.HOST ?? '0.0.0.0',
});

const { port } = await server.listen();
process.stdout.write(`${JSON.stringify({ msg: 'identity_auth0_grpc_listening', port })}\n`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void server.stop().then(() => process.exit(0));
  });
}
