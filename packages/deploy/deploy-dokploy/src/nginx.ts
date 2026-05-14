import type { EdgeMiddleware, EdgePlan, EdgeRoute } from '@rntme/deploy-core';

type AuthMiddleware = Extract<EdgeMiddleware, { kind: 'auth' }>;

type AuthProviderBlock = {
  readonly chainKey: string;
  readonly providerIndex: number;
  readonly provider: string;
  readonly moduleSlug: string;
  readonly audience: string;
  readonly upstream: string;
  readonly upstreamKey: string;
  readonly introspectPath: string;
  readonly nextInternalPath: string | null;
};

type AuthChainBlock = {
  readonly key: string;
  readonly firstInternalPath: string;
  readonly providers: readonly AuthProviderBlock[];
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
  const authChains = buildAuthChains(authMiddlewares, upstreams);
  const allProviderBlocks = authChains.flatMap((c) => c.providers);

  const uniqueUpstreams = new Map<string, { key: string; upstream: string }>();
  for (const b of allProviderBlocks) {
    if (!uniqueUpstreams.has(b.upstreamKey)) {
      uniqueUpstreams.set(b.upstreamKey, { key: b.upstreamKey, upstream: b.upstream });
    }
  }
  const upstreamLines = [...uniqueUpstreams.values()].map(
    (u) => `  upstream ${u.key} {\n    server ${u.upstream};\n  }`,
  );

  const internalLocations = allProviderBlocks.map((b) => renderAuthInternalLocation(b));
  const named401Locations = authChains.map((c) => renderAuthNamed401Location(c));

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

function buildAuthChains(
  middlewares: readonly AuthMiddleware[],
  upstreams: Readonly<Record<string, string>>,
): AuthChainBlock[] {
  const seen = new Map<string, AuthChainBlock>();
  for (const m of middlewares) {
    assertSafeMiddlewareName(m.name);
    const chainKey = `${zoneName(m.mountTarget)}__${m.name}`;
    if (seen.has(chainKey)) continue;
    if (m.providers.length === 0) {
      throw new TypeError(`auth middleware ${m.name} on ${m.mountTarget} has no providers`);
    }

    const providers: AuthProviderBlock[] = m.providers.map((p, i) => {
      assertSafeSlug(p.moduleSlug);
      const audience = p.audience ?? '';
      if (audience !== '') assertSafeAudience(audience);
      const introspectPath = p.introspectPath;
      assertSafeLocationPath(introspectPath);
      const upstreamUrl = upstreams[p.moduleSlug] ?? `http://${p.moduleSlug}:${p.introspectPort}`;
      const upstreamHost = stripScheme(upstreamUrl);
      assertSafeUpstreamHost(upstreamHost);
      const upstreamKey = `rntme_auth_${p.moduleSlug}__${p.index}`;
      const isLast = i === m.providers.length - 1;
      const nextInternalPath = isLast
        ? null
        : `/_rntme_auth_chain_${chainKey}_${m.providers[i + 1]!.index}`;
      return {
        chainKey,
        providerIndex: p.index,
        provider: p.provider,
        moduleSlug: p.moduleSlug,
        audience,
        upstream: upstreamHost,
        upstreamKey,
        introspectPath,
        nextInternalPath,
      };
    });

    const firstInternalPath = `/_rntme_auth_chain_${chainKey}_${providers[0]!.providerIndex}`;
    seen.set(chainKey, {
      key: chainKey,
      firstInternalPath,
      providers,
    });
  }
  return [...seen.values()];
}

function renderAuthInternalLocation(b: AuthProviderBlock): string {
  const lines = [
    `    location = /_rntme_auth_chain_${b.chainKey}_${b.providerIndex} {`,
    '      internal;',
    '      client_max_body_size 0;',
    `      proxy_pass         http://${b.upstreamKey}${b.introspectPath};`,
    '      proxy_pass_request_body off;',
    '      proxy_set_header   content-length     "";',
    '      proxy_set_header   Authorization      $http_authorization;',
  ];
  if (b.audience !== '') {
    lines.push(`      proxy_set_header   X-Rntme-Audience   "${b.audience}";`);
  }
  lines.push('      proxy_intercept_errors on;');
  if (b.nextInternalPath !== null) {
    lines.push(`      error_page 401 = ${b.nextInternalPath};`);
  }
  lines.push('    }');
  return lines.join('\n');
}

function renderAuthNamed401Location(c: AuthChainBlock): string {
  return [
    `    location @rntme_auth_401_${c.key} {`,
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
      lines.push('      proxy_request_buffering off;');
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
      assertSafeMiddlewareName(m.name);
      const chainKey = `${zoneName(m.mountTarget)}__${m.name}`;
      const providerSummary = m.providers
        .map((p) => `${commentValue(p.provider)}${p.audience ? `(${commentValue(p.audience)})` : ''}`)
        .join(' -> ');
      lines.push(`      # auth middleware: chain=${providerSummary}`);
      lines.push(
        `      auth_request          /_rntme_auth_chain_${chainKey}_${m.providers[0]!.index};`,
      );
      lines.push(`      auth_request_set      $rntme_user_sub      $upstream_http_x_rntme_user_sub;`);
      lines.push(`      auth_request_set      $rntme_user_audience $upstream_http_x_rntme_user_audience;`);
      lines.push(`      auth_request_set      $rntme_session_status $upstream_http_x_rntme_session_status;`);
      lines.push(`      error_page 401        = @rntme_auth_401_${chainKey};`);
      lines.push(`      proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;`);
      lines.push(`      proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;`);
      lines.push(`      proxy_set_header      X-Rntme-Session-Status $rntme_session_status;`);
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

function assertSafeMiddlewareName(name: string): void {
  if (!/^[A-Za-z0-9]+$/.test(name)) {
    throw new TypeError(`unsafe middleware name for nginx chain key: ${name}`);
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
