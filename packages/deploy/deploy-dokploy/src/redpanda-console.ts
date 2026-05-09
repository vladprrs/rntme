import type { PlannedRedpandaConsoleAccess, ProjectDeploymentPlan } from '@rntme/deploy-core';
import {
  consoleLimits,
  proxyLimits,
  runtimeRestartPolicy,
  type RenderedComposeDomain,
  type RenderedComposeService,
} from './compose-model.js';

const PROXY_BOOTSTRAP_SCRIPT = `set -eu
printf '%s' "$RNTME_CONSOLE_HTPASSWD_B64" | base64 -d > /etc/nginx/.htpasswd
chmod 600 /etc/nginx/.htpasswd
exec nginx -g 'daemon off;'
`;

export function renderRedpandaConsoleServices(
  plan: ProjectDeploymentPlan,
  planned: PlannedRedpandaConsoleAccess,
): { services: readonly RenderedComposeService[]; domains: readonly RenderedComposeDomain[] } {
  void plan;
  const consoleService: RenderedComposeService = {
    name: 'redpanda-console',
    logicalId: 'redpanda-console',
    serviceClass: 'infrastructure-proxy',
    image: planned.image,
    env: [
      { name: 'KAFKA_BROKERS', value: 'redpanda:9092', secret: false },
      { name: 'SERVER_LISTENADDRESS', value: '0.0.0.0', secret: false },
      { name: 'SERVER_LISTENPORT', value: '8080', secret: false },
      { name: 'ANALYTICS_ENABLED', value: 'false', secret: false },
    ],
    ports: [8080],
    restart: runtimeRestartPolicy(),
    resources: consoleLimits(),
  };

  const proxyService: RenderedComposeService = {
    name: 'redpanda-console-proxy',
    logicalId: 'redpanda-console-proxy',
    serviceClass: 'infrastructure-proxy',
    image: 'nginx:1.27-alpine',
    command: '/bin/sh',
    args: ['/docker-entrypoint-rntme.sh'],
    env: [
      {
        name: 'RNTME_CONSOLE_HTPASSWD_B64',
        value: planned.htpasswdSecretRef,
        secret: true,
      },
    ],
    ports: [8080],
    restart: runtimeRestartPolicy(),
    resources: proxyLimits(),
    files: {
      '/etc/nginx/nginx.conf': renderConsoleProxyNginxConfig('redpanda-console'),
      '/docker-entrypoint-rntme.sh': PROXY_BOOTSTRAP_SCRIPT,
    },
  };

  const domain = composeDomain(planned.publicBaseUrl, 'redpanda-console-proxy', 8080);
  return { services: [consoleService, proxyService], domains: [domain] };
}

function composeDomain(publicBaseUrl: string, serviceName: string, containerPort: number): RenderedComposeDomain {
  const url = new URL(publicBaseUrl);
  return {
    host: url.host,
    path: '/',
    serviceName,
    containerPort,
    https: url.protocol === 'https:',
  };
}

function renderConsoleProxyNginxConfig(upstreamHostname: string): string {
  return [
    'worker_processes 1;',
    'events { worker_connections 1024; }',
    'http {',
    '  client_max_body_size 2m;',
    '  server {',
    '    listen 8080;',
    '    location /health { return 204; access_log off; }',
    '    location / {',
    '      auth_basic "Restricted";',
    '      auth_basic_user_file /etc/nginx/.htpasswd;',
    `      proxy_pass http://${upstreamHostname}:8080;`,
    '      proxy_http_version 1.1;',
    '      proxy_set_header Host $host;',
    '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    '      proxy_set_header X-Forwarded-Proto $scheme;',
    '      proxy_set_header X-Forwarded-Host $host;',
    '      proxy_set_header Authorization "";',
    '      proxy_connect_timeout 30s;',
    '      proxy_read_timeout 3600s;',
    '      proxy_send_timeout 3600s;',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n');
}
