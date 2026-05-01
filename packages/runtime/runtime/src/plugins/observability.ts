import type { Hono } from 'hono';
import { Registry, Counter, Gauge, collectDefaultMetrics } from 'prom-client';

export type HealthProbe = () => { ok: true } | { ok: false; reason: string };

export type Metrics = {
  registry: Registry;
  commandsTotal: Counter<string>;
  eventsAppendedTotal: Counter<string>;
  httpRequestsTotal: Counter<string>;
  projectionLagEvents: Gauge<string>;
  relayCursor: Gauge<string>;
  externalPreStep: Counter<string>;
};

export function createMetrics(serviceName: string): Metrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service: serviceName });
  collectDefaultMetrics({ register: registry });

  const commandsTotal = new Counter({
    name: 'rntme_commands_total',
    help: 'Command executions.',
    labelNames: ['graph', 'status'] as const,
    registers: [registry],
  });
  const eventsAppendedTotal = new Counter({
    name: 'rntme_events_appended_total',
    help: 'Events appended to the log.',
    labelNames: ['stream_type'] as const,
    registers: [registry],
  });
  const httpRequestsTotal = new Counter({
    name: 'rntme_http_requests_total',
    help: 'HTTP requests served.',
    labelNames: ['route', 'method', 'status'] as const,
    registers: [registry],
  });
  const projectionLagEvents = new Gauge({
    name: 'rntme_projection_lag_events',
    help: 'Events appended minus events projected.',
    registers: [registry],
  });
  const relayCursor = new Gauge({
    name: 'rntme_relay_cursor',
    help: 'Current relay cursor position.',
    registers: [registry],
  });
  const externalPreStep = new Counter({
    name: 'external_pre_step_total',
    help: 'Count of pre-fetch steps executed, labelled by module/rpc/result/error_code',
    labelNames: ['module', 'rpc', 'result', 'error_code'] as const,
    registers: [registry],
  });
  return {
    registry,
    commandsTotal,
    eventsAppendedTotal,
    httpRequestsTotal,
    projectionLagEvents,
    relayCursor,
    externalPreStep,
  };
}

export function recordPreStep(metrics: Metrics, labels: {
  module: string; rpc: string; result: 'ok' | 'error'; error_code?: string;
}): void {
  metrics.externalPreStep?.labels({
    module: labels.module, rpc: labels.rpc, result: labels.result,
    error_code: labels.error_code ?? '',
  }).inc();
}

export function mountObservability(
  app: Hono,
  opts: {
    healthPath: string;
    metricsPath: string;
    probe: HealthProbe;
    metrics: Metrics;
  },
): void {
  app.get(opts.healthPath, (c) => {
    const r = opts.probe();
    return r.ok ? c.json({ ok: true }) : c.json({ ok: false, reason: r.reason }, 503);
  });
  app.get(opts.metricsPath, async (c) => {
    const body = await opts.metrics.registry.metrics();
    return c.text(body, 200, { 'content-type': opts.metrics.registry.contentType });
  });
}
