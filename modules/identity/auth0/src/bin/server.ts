import { createAuth0Adapter } from '../adapter.js';
import { createAuth0IdentityModule } from '../handlers.js';
import { createIdentityAuth0HttpServer } from '../http-server.js';
import { createIdentityAuth0GrpcServer } from '../server.js';

function portErrorLabel(envName: string, fallbackName: string | null): string {
  return fallbackName === null ? envName : `${envName}/${fallbackName}`;
}

function readPort(envName: string, fallbackName: string | null, defaultPort: number): number {
  const raw =
    process.env[envName] ?? (fallbackName !== null ? process.env[fallbackName] : undefined) ?? String(defaultPort);
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) {
    throw new Error(`Invalid ${portErrorLabel(envName, fallbackName)} value: ${raw}`);
  }
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid ${portErrorLabel(envName, fallbackName)} value: ${raw}`);
  }
  return port;
}

function logStopErrors(results: PromiseSettledResult<void>[]): void {
  for (const result of results) {
    if (result.status === 'rejected') {
      process.stderr.write(
        `${JSON.stringify({
          msg: 'identity_auth0_server_stop_failed',
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })}\n`,
      );
    }
  }
}

const adapter = createAuth0Adapter();
const module = createAuth0IdentityModule(adapter);

const grpcPort = readPort('PORT', 'GRPC_PORT', 50051);
const httpPort = readPort('HTTP_PORT', null, 50052);
const host = process.env.HOST ?? '0.0.0.0';

const grpc = createIdentityAuth0GrpcServer({ module, port: grpcPort, host });
const http = createIdentityAuth0HttpServer({ module, port: httpPort, host });

let grpcInfo: { port: number };
let httpInfo: { port: number };
try {
  [grpcInfo, httpInfo] = await Promise.all([grpc.listen(), http.listen()]);
} catch (error) {
  await Promise.allSettled([grpc.stop(), http.stop()]);
  throw error;
}

process.stdout.write(
  `${JSON.stringify({ msg: 'identity_auth0_grpc_listening', port: grpcInfo.port })}\n`,
);
process.stdout.write(
  `${JSON.stringify({ msg: 'identity_auth0_http_listening', port: httpInfo.port })}\n`,
);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  const results = await Promise.allSettled([grpc.stop(), http.stop()]);
  logStopErrors(results);
  process.exit(results.every((result) => result.status === 'fulfilled') ? 0 : 1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown();
  });
}
