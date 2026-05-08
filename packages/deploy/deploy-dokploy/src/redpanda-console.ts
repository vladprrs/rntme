import type { PlannedRedpandaConsoleAccess, ProjectDeploymentPlan } from '@rntme/deploy-core';
import { dokployLabels } from './names.js';
import type {
  RenderedDokployApplicationResource,
  RenderedDokployIngress,
  RenderedDokployPort,
} from './render.js';

const PROXY_BOOTSTRAP_SCRIPT = `set -eu
printf '%s' "$RNTME_CONSOLE_HTPASSWD_B64" | base64 -d > /etc/nginx/.htpasswd
chmod 600 /etc/nginx/.htpasswd
exec nginx -g 'daemon off;'
`;

export function consoleBootstrapScriptDigest(): string {
  return `${PROXY_BOOTSTRAP_SCRIPT.length}`;
}

export function renderRedpandaConsoleApplications(
  plan: ProjectDeploymentPlan,
  planned: PlannedRedpandaConsoleAccess,
  eventBusResourceName: string,
): readonly RenderedDokployApplicationResource[] {
  const { orgSlug, projectSlug, environment } = plan.project;

  const consoleLabels = {
    ...dokployLabels(orgSlug, projectSlug, environment, 'redpanda-console'),
    'rntme.infrastructure': 'redpanda-console',
    'rntme.access': 'internal',
  };

  const consoleApp: RenderedDokployApplicationResource = {
    logicalId: 'redpanda-console',
    kind: 'application',
    infrastructureKind: 'redpanda-console',
    name: planned.resourceName,
    image: planned.image,
    env: [
      { name: 'KAFKA_BROKERS', value: `${eventBusResourceName}:9092`, secret: false },
      { name: 'SERVER_LISTENADDRESS', value: '0.0.0.0', secret: false },
      { name: 'SERVER_LISTENPORT', value: '8080', secret: false },
      { name: 'ANALYTICS_ENABLED', value: 'false', secret: false },
    ],
    labels: consoleLabels,
  };

  const nginxConf = renderConsoleProxyNginxConfig(planned.resourceName);
  const proxyLabels = {
    ...dokployLabels(orgSlug, projectSlug, environment, 'redpanda-console-proxy'),
    'rntme.infrastructure': 'redpanda-console-proxy',
    'rntme.access': 'public',
    'rntme.console.basic-auth-user': planned.basicAuthUsername,
  };

  const ingressRoutes: RenderedDokployIngress['routes'] = [
    {
      routeId: 'redpanda-console-root',
      path: '/',
      url: joinUrl(planned.publicBaseUrl, '/'),
    },
  ];

  const proxyPorts: readonly RenderedDokployPort[] = [{ containerPort: 8080, protocol: 'http' }];
  const ingress: RenderedDokployIngress = {
    publicBaseUrl: planned.publicBaseUrl,
    containerPort: 8080,
    healthPath: '/health',
    routes: ingressRoutes,
  };

  const proxyApp: RenderedDokployApplicationResource = {
    logicalId: 'redpanda-console-proxy',
    kind: 'application',
    infrastructureKind: 'redpanda-console-proxy',
    name: planned.proxyResourceName,
    image: 'nginx:1.27-alpine',
    command: '/bin/sh',
    args: ['/docker-entrypoint-rntme.sh'],
    ports: proxyPorts,
    ingress,
    env: [
      {
        name: 'RNTME_CONSOLE_HTPASSWD_B64',
        value: planned.htpasswdSecretRef,
        secret: true,
      },
    ],
    labels: proxyLabels,
    files: {
      '/etc/nginx/nginx.conf': nginxConf,
      '/docker-entrypoint-rntme.sh': PROXY_BOOTSTRAP_SCRIPT,
    },
    secretResolutionHints: {
      redpandaConsoleHtpasswd: {
        secretRef: planned.htpasswdSecretRef,
        expectedUsername: planned.basicAuthUsername,
      },
    },
  };

  return [consoleApp, proxyApp];
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

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(path, normalizedBase).toString();
}
