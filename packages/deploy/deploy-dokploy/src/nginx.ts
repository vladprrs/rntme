import { createHash } from 'node:crypto';
import type { EdgeMiddleware, EdgePlan, EdgeRoute } from '@rntme/deploy-core';

type AuthMiddleware = Extract<EdgeMiddleware, { kind: 'auth' }>;

type AuthBlock = {
  readonly slug: string;
  readonly audHash: string;
  readonly audience: string;
  readonly upstream: string;
  readonly key: string; // <slug>__<audHash>
};

export function renderNginxConfig(
  edge: EdgePlan,
  upstreams: Readonly<Record<string, string>>,
): string {
  const rateLimitZones = edge.middleware
    .filter((m): m is Extract<EdgeMiddleware, { kind: 'rate-limit' }> => m.kind === 'rate-limit')
    .map((m) => {
      const zone = zoneName(m.mountTarget);
      return `limit_req_zone $binary_remote_addr zone=${zone}:10m rate=${m.config.requestsPerMinute}r/m;`;
    });

  const authMiddlewares = edge.middleware.filter((m): m is AuthMiddleware => m.kind === 'auth');
  const authBlocks = buildAuthBlocks(authMiddlewares, upstreams);
  const upstreamLines = authBlocks.map(
    (b) => `  upstream rntme_auth_${b.key} {\n    server ${b.upstream};\n  }`,
  );

  const internalLocations = authBlocks.map((b) => renderAuthInternalLocation(b));
  const named401Locations = authBlocks.map((b) => renderAuthNamed401Location(b));

  const locations = edge.routes.map((route) =>
    renderLocation(
      route,
      upstreams[route.targetWorkload] ?? `http://${route.targetWorkload}:3000`,
      edge.middleware,
    ),
  );

  const internalAuthFallback = '    location ~ ^/_rntme_auth_ {\n      return 404;\n    }';

  return [
    'events {}',
    'http {',
    ...rateLimitZones.map((line) => `  ${line}`),
    ...upstreamLines,
    '  server {',
    '    listen 8080;',
    '    location = /health { return 200 "ok\\n"; }',
    ...renderConfigLocation(),
    ...internalLocations,
    ...named401Locations,
    internalAuthFallback,
    ...locations,
    '  }',
    '}',
    '',
  ].join('\n');
}

function buildAuthBlocks(
  middlewares: readonly AuthMiddleware[],
  upstreams: Readonly<Record<string, string>>,
): AuthBlock[] {
  const seen = new Map<string, AuthBlock>();
  for (const m of middlewares) {
    assertSafeSlug(m.moduleSlug);
    assertSafeAudience(m.audience);
    const audHash = sha256Hex8(m.audience);
    const key = `${m.moduleSlug}__${audHash}`;
    if (seen.has(key)) continue;
    const upstreamUrl = upstreams[m.moduleSlug] ?? `http://${m.moduleSlug}:${m.moduleIntrospectPort}`;
    const upstreamHost = stripScheme(upstreamUrl);
    assertSafeUpstreamHost(upstreamHost);
    seen.set(key, {
      slug: m.moduleSlug,
      audHash,
      audience: m.audience,
      upstream: upstreamHost,
      key,
    });
  }
  return [...seen.values()];
}

function renderAuthInternalLocation(b: AuthBlock): string {
  return [
    `    location = /_rntme_auth_${b.key} {`,
    '      internal;',
    `      proxy_pass         http://rntme_auth_${b.key}/introspect;`,
    '      proxy_pass_request_body off;',
    '      proxy_set_header   content-length     "";',
    '      proxy_set_header   Authorization      $http_authorization;',
    `      proxy_set_header   X-Rntme-Audience   "${b.audience}";`,
    '      proxy_intercept_errors on;',
    '    }',
  ].join('\n');
}

function renderAuthNamed401Location(b: AuthBlock): string {
  return [
    `    location @rntme_auth_401_${b.key} {`,
    '      default_type application/json;',
    `      return 401 '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}';`,
    '    }',
  ].join('\n');
}

function renderConfigLocation(): string[] {
  return [
    '    location = /config.json {',
    '      default_type application/json;',
    '      alias /srv/config.json;',
    '    }',
  ];
}

function renderLocation(
  route: EdgeRoute,
  upstream: string,
  middleware: readonly EdgeMiddleware[],
): string {
  assertSafeLocationPath(route.path);
  assertSafeUpstreamUrl(upstream);
  const applied = middleware.filter((m) => m.mountTarget === route.id);
  const lines = [`    location ${route.path} {`];

  for (const m of applied) {
    if (m.kind === 'rate-limit') {
      lines.push(`      limit_req zone=${zoneName(m.mountTarget)} burst=${m.config.burst};`);
    }
    if (m.kind === 'body-limit') {
      assertSafeBodyLimit(m.config.maxBodySize);
      lines.push(`      client_max_body_size ${m.config.maxBodySize};`);
    }
    if (m.kind === 'timeout') {
      const seconds = Math.ceil(m.config.upstreamTimeoutMs / 1000);
      lines.push(`      proxy_connect_timeout ${seconds}s;`);
      lines.push(`      proxy_read_timeout ${seconds}s;`);
      lines.push(`      proxy_send_timeout ${seconds}s;`);
    }
    if (m.kind === 'request-context') {
      const requestHeader = m.config.requestIdHeader ?? 'x-request-id';
      const correlationHeader = m.config.correlationIdHeader ?? 'x-correlation-id';
      assertSafeHeaderName(requestHeader);
      assertSafeHeaderName(correlationHeader);
      lines.push(`      proxy_set_header ${requestHeader} $request_id;`);
      lines.push(
        `      proxy_set_header ${correlationHeader} $http_${headerVariable(correlationHeader)};`,
      );
    }
    if (m.kind === 'auth') {
      const audHash = sha256Hex8(m.audience);
      const key = `${m.moduleSlug}__${audHash}`;
      lines.push(`      # auth middleware: provider=${commentValue(m.provider)}, audience=${commentValue(m.audience)}`);
      lines.push(`      auth_request          /_rntme_auth_${key};`);
      lines.push(`      auth_request_set      $rntme_user_sub      $upstream_http_x_rntme_user_sub;`);
      lines.push(`      auth_request_set      $rntme_user_audience $upstream_http_x_rntme_user_audience;`);
      lines.push(`      error_page 401        = @rntme_auth_401_${key};`);
      lines.push(`      proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;`);
      lines.push(`      proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;`);
      lines.push(`      proxy_set_header      Authorization         $http_authorization;`);
    }
  }

  lines.push('      proxy_set_header Host $host;');
  lines.push('      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
  lines.push(`      proxy_pass ${upstream};`);
  lines.push('    }');
  return lines.join('\n');
}

function zoneName(target: string): string {
  return target.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function headerVariable(header: string): string {
  return header.toLowerCase().replace(/-/g, '_');
}

function commentValue(value: string): string {
  return value.replace(/[\r\n]/g, ' ').replace(/\*\//g, '* /');
}

function sha256Hex8(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

function assertSafeLocationPath(path: string): void {
  if (!/^\/[A-Za-z0-9/_~.-]*$/.test(path)) {
    throw new TypeError(`unsafe Nginx location path: ${path}`);
  }
}

function assertSafeHeaderName(header: string): void {
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(header)) {
    throw new TypeError(`unsafe Nginx header name: ${header}`);
  }
}

function assertSafeBodyLimit(value: string): void {
  if (!/^(0|[1-9][0-9]*[kKmMgG]?)$/.test(value)) {
    throw new TypeError(`unsafe Nginx body limit: ${value}`);
  }
}

function assertSafeUpstreamUrl(url: string): void {
  if (hasUnsafeRawUpstreamChar(url)) {
    throw new TypeError(`unsafe Nginx upstream URL: ${url}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError(`unsafe Nginx upstream URL: ${url}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError(`unsafe Nginx upstream URL: ${url}`);
  }
}

function assertSafeUpstreamHost(host: string): void {
  if (!/^[A-Za-z0-9.\-_]+(:\d+)?$/.test(host)) {
    throw new TypeError(`unsafe Nginx upstream host: ${host}`);
  }
}

function assertSafeSlug(slug: string): void {
  if (!/^[A-Za-z0-9-]+$/.test(slug)) {
    throw new TypeError(`unsafe slug for nginx upstream/location: ${slug}`);
  }
}

function assertSafeAudience(audience: string): void {
  // Allow common URI chars; reject quote/backslash/control chars that would break
  // out of the double-quoted nginx directive value.
  if (!/^[A-Za-z0-9:/?#@!$&'()*+,;=._~%-]+$/.test(audience)) {
    throw new TypeError(`unsafe audience for nginx directive: ${audience}`);
  }
}

function hasUnsafeRawUpstreamChar(value: string): boolean {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0x20 || code === 0x7f || char === ';' || char === '{' || char === '}') {
      return true;
    }
  }
  return false;
}
