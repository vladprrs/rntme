export type LiveDokployEnv =
  | { readonly enabled: false; readonly reason: string }
  | {
    readonly enabled: true;
    readonly dokployUrl: string;
    readonly dokployApiToken: string;
    readonly dokployProjectId: string;
    readonly publicDeployDomain: string;
    readonly runtimeImage: string;
    readonly bpmnWorkerImage: string;
    readonly operatonImage: string;
    readonly redpandaImage?: string;
    readonly httpTimeoutMs: number;
  };

export function readLiveDokployEnv(env: NodeJS.ProcessEnv = process.env): LiveDokployEnv {
  if (env['RNTME_DOKPLOY_E2E'] !== '1') {
    return { enabled: false, reason: 'RNTME_DOKPLOY_E2E is not 1' };
  }
  const required = [
    'RNTME_DOKPLOY_URL',
    'RNTME_DOKPLOY_API_TOKEN',
    'RNTME_DOKPLOY_PROJECT_ID',
    'RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN',
    'RNTME_E2E_RUNTIME_IMAGE',
    'RNTME_E2E_BPMN_WORKER_IMAGE',
    'RNTME_E2E_OPERATON_IMAGE',
  ] as const;
  const missing = required.filter((name) => (env[name] ?? '').trim() === '');
  if (missing.length > 0) {
    return { enabled: false, reason: `missing ${missing.join(', ')}` };
  }
  return {
    enabled: true,
    dokployUrl: env['RNTME_DOKPLOY_URL']!.trim(),
    dokployApiToken: env['RNTME_DOKPLOY_API_TOKEN']!.trim(),
    dokployProjectId: env['RNTME_DOKPLOY_PROJECT_ID']!.trim(),
    publicDeployDomain: env['RNTME_DOKPLOY_PUBLIC_DEPLOY_DOMAIN']!.trim().replace(/^\*\./, ''),
    runtimeImage: env['RNTME_E2E_RUNTIME_IMAGE']!.trim(),
    bpmnWorkerImage: env['RNTME_E2E_BPMN_WORKER_IMAGE']!.trim(),
    operatonImage: env['RNTME_E2E_OPERATON_IMAGE']!.trim(),
    ...(env['RNTME_E2E_REDPANDA_IMAGE'] ? { redpandaImage: env['RNTME_E2E_REDPANDA_IMAGE'].trim() } : {}),
    httpTimeoutMs: Number.parseInt(env['RNTME_E2E_HTTP_TIMEOUT_MS'] ?? '180000', 10),
  };
}
