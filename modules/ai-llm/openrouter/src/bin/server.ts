import { createIdempotencyStore } from '../idempotency-store.js';
import { createOpenRouterModule } from '../handler.js';
import { createOpenRouterGrpcServer } from '../server.js';

function readPort(envName: string, defaultPort: number): number {
  const raw = process.env[envName] ?? String(defaultPort);
  if (!/^(0|[1-9][0-9]*)$/.test(raw)) throw new Error(`Invalid ${envName} value: ${raw}`);
  const port = Number.parseInt(raw, 10);
  if (port < 0 || port > 65_535) throw new Error(`Invalid ${envName} value: ${raw}`);
  return port;
}

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_API_KEY is required');

const baseUrl = process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
const grpcPort = readPort('PORT', 50051);
const host = process.env.HOST ?? '0.0.0.0';

const idempotencyMode = (process.env.OPENROUTER_IDEMPOTENCY_MODE ?? 'sqlite') as 'sqlite' | 'memory';
const idempotencyPath = process.env.OPENROUTER_IDEMPOTENCY_PATH ?? '/data/idempotency.sqlite';
const ttlMs = 24 * 3600_000;
const store = createIdempotencyStore(
  idempotencyMode === 'memory'
    ? { mode: 'memory', ttlMs }
    : { mode: 'sqlite', path: idempotencyPath, ttlMs },
);

const bus = {
  async emit(type: string, data: unknown): Promise<void> {
    process.stdout.write(`${JSON.stringify({ msg: 'ai_llm_openrouter_event', type, data })}\n`);
  },
};

const moduleOpts: Parameters<typeof createOpenRouterModule>[0] = {
  apiKey,
  baseUrl,
  store,
  bus,
  now: () => Date.now(),
  xTitle: 'rntme',
};
if (process.env.OPENROUTER_HTTP_REFERER) {
  moduleOpts.httpReferer = process.env.OPENROUTER_HTTP_REFERER;
}
const module = createOpenRouterModule(moduleOpts);

const grpcServer = createOpenRouterGrpcServer({ module, port: grpcPort, host });

const grpcInfo = await grpcServer.listen();
process.stdout.write(`${JSON.stringify({ msg: 'ai_llm_openrouter_grpc_listening', port: grpcInfo.port })}\n`);

const sweepHandle = setInterval(() => void store.evictExpired(), 3600_000);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(sweepHandle);
  await Promise.allSettled([grpcServer.stop(), store.close()]);
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown());
}
