import { describe, expect, it } from 'bun:test';
import type { EdgePlan } from '@rntme/deploy-core';
import { renderNginxConfig } from '../../src/nginx.js';

describe('renderNginxConfig', () => {
  it('renders upstreams, routes, request context, and rate limits', () => {
    const edge: EdgePlan = {
      routes: [
        { id: 'ui:/', kind: 'ui', path: '/', targetService: 'app', targetWorkload: 'app' },
        {
          id: 'http:/api/catalog',
          kind: 'http',
          path: '/api/catalog',
          targetService: 'catalog',
          targetWorkload: 'catalog',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api/catalog',
          name: 'rateLimit',
          kind: 'rate-limit',
          policy: 'default',
          config: { requestsPerMinute: 60, burst: 20 },
        },
        {
          mountTarget: 'ui:/',
          name: 'requestContext',
          kind: 'request-context',
          policy: 'default',
          config: { requestIdHeader: 'x-request-id', correlationIdHeader: 'x-correlation-id' },
        },
      ],
    };

    const rendered = renderNginxConfig(edge, {
      app: 'http://rntme-acme-commerce-app:3000',
      catalog: 'http://rntme-acme-commerce-catalog:3000',
    });

    expect(rendered).toContain(
      'limit_req_zone $binary_remote_addr zone=http_api_catalog:10m rate=60r/m;',
    );
    expect(rendered).toContain('location = /config.json');
    expect(rendered).toContain('proxy_pass http://rntme-acme-commerce-catalog:3000;');
    expect(rendered).toContain('proxy_set_header x-request-id $request_id;');
    expect(rendered).toContain('location /api/catalog');
  });

  it('renders body limits and timeouts', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/uploads',
          kind: 'http',
          path: '/uploads',
          targetService: 'uploads',
          targetWorkload: 'uploads',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/uploads',
          name: 'bodyLimit',
          kind: 'body-limit',
          policy: 'default',
          config: { maxBodySize: '10m' },
        },
        {
          mountTarget: 'http:/uploads',
          name: 'timeout',
          kind: 'timeout',
          policy: 'default',
          config: { upstreamTimeoutMs: 2500 },
        },
      ],
    };

    const rendered = renderNginxConfig(edge, {
      uploads: 'https://uploads.internal:8443',
    });

    expect(rendered).toContain('client_max_body_size 10m;');
    expect(rendered).toContain('proxy_connect_timeout 3s;');
    expect(rendered).toContain('proxy_read_timeout 3s;');
    expect(rendered).toContain('proxy_send_timeout 3s;');
  });

  it('renders auth middleware with auth_request enforcement', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/api',
          kind: 'http',
          path: '/api',
          targetService: 'app',
          targetWorkload: 'app',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api',
          name: 'auth',
          kind: 'auth',
          providers: [
            {
              index: 0,
              provider: 'auth0',
              audience: 'https://commerce.example.com/api',
              moduleSlug: 'identity-auth0',
              introspectPath: '/introspect',
              introspectPort: 50052,
            },
          ],
        },
      ],
    };

    const rendered = renderNginxConfig(edge, {
      app: 'http://app:3000',
      'identity-auth0': 'http://app-identity-auth0:50052',
    });

    expect(rendered).toContain('# auth middleware: chain=auth0(https://commerce.example.com/api)');
    expect(rendered).toContain('auth_request');
    expect(rendered).not.toContain('# - delegated to runtime via identity module RPC; edge does not validate JWT');
  });

  it('rejects unsafe route paths before rendering locations', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/bad',
          kind: 'http',
          path: '/bad; return 200',
          targetService: 'catalog',
          targetWorkload: 'catalog',
        },
      ],
      middleware: [],
    };

    expect(() =>
      renderNginxConfig(edge, { catalog: 'http://rntme-acme-commerce-catalog:3000' }),
    ).toThrow(TypeError);
  });

  it('rejects unsafe request-context header names', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/api/catalog',
          kind: 'http',
          path: '/api/catalog',
          targetService: 'catalog',
          targetWorkload: 'catalog',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api/catalog',
          name: 'requestContext',
          kind: 'request-context',
          policy: 'default',
          config: { requestIdHeader: 'x-request-id\nx-bad', correlationIdHeader: 'x-correlation-id' },
        },
      ],
    };

    expect(() =>
      renderNginxConfig(edge, { catalog: 'http://rntme-acme-commerce-catalog:3000' }),
    ).toThrow(TypeError);
  });

  it('rejects unsafe body limit values', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/api/catalog',
          kind: 'http',
          path: '/api/catalog',
          targetService: 'catalog',
          targetWorkload: 'catalog',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api/catalog',
          name: 'bodyLimit',
          kind: 'body-limit',
          policy: 'default',
          config: { maxBodySize: '10m; include /etc/passwd' },
        },
      ],
    };

    expect(() =>
      renderNginxConfig(edge, { catalog: 'http://rntme-acme-commerce-catalog:3000' }),
    ).toThrow(TypeError);
  });

  it('renders a byte-exact golden config for all four middleware kinds across two routes', () => {
    const edge: EdgePlan = {
      routes: [
        { id: 'ui:/', kind: 'ui', path: '/', targetService: 'app', targetWorkload: 'app' },
        {
          id: 'http:/api/catalog',
          kind: 'http',
          path: '/api/catalog',
          targetService: 'catalog',
          targetWorkload: 'catalog',
        },
      ],
      middleware: [
        {
          mountTarget: 'ui:/',
          name: 'requestContext',
          kind: 'request-context',
          policy: 'default',
          config: { requestIdHeader: 'x-request-id', correlationIdHeader: 'x-correlation-id' },
        },
        {
          mountTarget: 'ui:/',
          name: 'bodyLimit',
          kind: 'body-limit',
          policy: 'default',
          config: { maxBodySize: '1m' },
        },
        {
          mountTarget: 'http:/api/catalog',
          name: 'rateLimit',
          kind: 'rate-limit',
          policy: 'default',
          config: { requestsPerMinute: 60, burst: 20 },
        },
        {
          mountTarget: 'http:/api/catalog',
          name: 'timeout',
          kind: 'timeout',
          policy: 'default',
          config: { upstreamTimeoutMs: 3000 },
        },
      ],
    };

    const rendered = renderNginxConfig(edge, {
      app: 'http://app:3000',
      catalog: 'http://catalog:3000',
    });

    const expected = [
      'events {}',
      'http {',
      '  limit_req_zone $binary_remote_addr zone=http_api_catalog:10m rate=60r/m;',
      '  server {',
      '    listen 8080;',
      '    location = /health { return 200 "ok\\n"; }',
      '    location = /config.json {',
      '      default_type application/json;',
      '      alias /srv/config.json;',
      '    }',
      '    location ~ ^/_rntme_auth_ {',
      '      return 404;',
      '    }',
      '    location / {',
      '      proxy_set_header x-request-id $request_id;',
      '      proxy_set_header x-correlation-id $http_x_correlation_id;',
      '      client_max_body_size 1m;',
      '      proxy_set_header Host $host;',
      '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '      proxy_pass http://app:3000;',
      '    }',
      '    location /api/catalog {',
      '      limit_req zone=http_api_catalog burst=20;',
      '      proxy_connect_timeout 3s;',
      '      proxy_read_timeout 3s;',
      '      proxy_send_timeout 3s;',
      '      proxy_set_header Host $host;',
      '      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '      proxy_pass http://catalog:3000;',
      '    }',
      '  }',
      '}',
      '',
    ].join('\n');

    expect(rendered).toBe(expected);
  });

  it('rejects unsafe upstream URLs', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/api/catalog',
          kind: 'http',
          path: '/api/catalog',
          targetService: 'catalog',
          targetWorkload: 'catalog',
        },
      ],
      middleware: [],
    };

    expect(() =>
      renderNginxConfig(edge, { catalog: 'http://catalog.internal:3000; proxy_pass http://bad' }),
    ).toThrow(TypeError);
  });
});

describe('auth middleware rendering', () => {
  function authEdge(): EdgePlan {
    return {
      routes: [
        {
          id: 'http:/api',
          kind: 'http',
          path: '/api',
          targetService: 'app',
          targetWorkload: 'app',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api',
          name: 'auth',
          kind: 'auth',
          providers: [
            {
              index: 0,
              provider: 'auth0',
              audience: 'https://notes-demo.rntme.com/api',
              moduleSlug: 'identity-auth0',
              introspectPath: '/introspect',
              introspectPort: 50052,
            },
          ],
        },
      ],
    };
  }

  it('renders an upstream block per provider entry', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });
    expect(rendered).toContain('upstream rntme_auth_identity-auth0__0 {');
    expect(rendered).toContain('server rntme-acme-notes-identity-auth0:50052;');
  });

  it('renders an internal location with X-Rntme-Audience set', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });
    expect(rendered).toContain('location = /_rntme_auth_chain_http_api__auth_0 {');
    expect(rendered).toContain('internal;');
    expect(rendered).toContain('proxy_pass         http://rntme_auth_identity-auth0__0/introspect;');
    expect(rendered).toContain('proxy_set_header   X-Rntme-Audience   "https://notes-demo.rntme.com/api";');
    expect(rendered).toContain('proxy_pass_request_body off;');
  });

  it('renders auth_request and forwards X-Rntme-User-* on /api', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });
    expect(rendered).toContain('auth_request          /_rntme_auth_chain_http_api__auth_0;');
    expect(rendered).toContain('proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;');
    expect(rendered).toContain('proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;');
    expect(rendered).toContain('error_page 401        = @rntme_auth_401_http_api__auth;');
  });

  it('renders a named 401 location returning JSON', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });
    expect(rendered).toContain('location @rntme_auth_401_http_api__auth {');
    expect(rendered).toContain('default_type application/json;');
    expect(rendered).toContain(`return 401 '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}';`);
  });

  it('emits an explicit 404 for ^/_rntme_auth_<anything> before SPA fallback', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/api',
          kind: 'http',
          path: '/api',
          targetService: 'app',
          targetWorkload: 'app',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api',
          name: 'auth',
          kind: 'auth',
          providers: [
            {
              index: 0,
              provider: 'auth0',
              audience: 'https://notes-demo.rntme.com/api',
              moduleSlug: 'identity-auth0',
              introspectPath: '/introspect',
              introspectPort: 50052,
            },
          ],
        },
      ],
    };

    const rendered = renderNginxConfig(edge, {
      app: 'http://app:3000',
      'identity-auth0': 'http://identity-auth0:50052',
    });

    expect(rendered).toContain('location ~ ^/_rntme_auth_');
    expect(rendered).toContain('return 404;');

    const blockIdx = rendered.indexOf('location ~ ^/_rntme_auth_');
    const tryFilesIdx = rendered.indexOf('try_files');
    if (tryFilesIdx !== -1) expect(blockIdx).toBeLessThan(tryFilesIdx);
  });

  it('does NOT render auth_request for routes without auth middleware', () => {
    const rendered = renderNginxConfig(
      {
        routes: [
          {
            id: 'http:/public',
            kind: 'http',
            path: '/public',
            targetService: 'app',
            targetWorkload: 'app',
          },
        ],
        middleware: [],
      },
      { app: 'http://rntme-acme-notes-app:3000' },
    );
    expect(rendered).not.toContain('auth_request');
  });

  it('renders the complete protected API auth contract in one config', () => {
    const rendered = renderNginxConfig(authEdge(), {
      app: 'http://rntme-acme-notes-app:3000',
      'identity-auth0': 'http://rntme-acme-notes-identity-auth0:50052',
    });

    expect(rendered).toContain('location = /config.json');
    expect(rendered).toContain('proxy_pass_request_body off;');
    expect(rendered).toContain('proxy_set_header   Authorization      $http_authorization;');
    expect(rendered).toContain('proxy_set_header   X-Rntme-Audience   "https://notes-demo.rntme.com/api";');
    expect(rendered).toContain('auth_request_set      $rntme_user_sub      $upstream_http_x_rntme_user_sub;');
    expect(rendered).toContain('auth_request_set      $rntme_user_audience $upstream_http_x_rntme_user_audience;');
    expect(rendered).toContain('proxy_set_header      X-Rntme-User-Sub      $rntme_user_sub;');
    expect(rendered).toContain('proxy_set_header      X-Rntme-User-Audience $rntme_user_audience;');
    expect(rendered).toContain('default_type application/json;');
    expect(rendered).toContain(`return 401 '{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}';`);
  });

  it('renders introspect path from introspectPath (platform-tokens style)', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/api/projects',
          kind: 'http',
          path: '/api/projects',
          targetService: 'projects',
          targetWorkload: 'projects',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api/projects',
          name: 'auth',
          kind: 'auth',
          providers: [
            {
              index: 0,
              provider: 'platform-tokens',
              moduleSlug: 'tokens',
              introspectPort: 3000,
              introspectPath: '/api/tokens/introspect',
            },
          ],
        },
      ],
    };

    const rendered = renderNginxConfig(edge, {
      projects: 'http://projects:3000',
      tokens: 'http://tokens:3000',
    });

    expect(rendered).toContain('proxy_pass         http://rntme_auth_tokens__0/api/tokens/introspect;');
    // platform-tokens has no audience → X-Rntme-Audience must not be emitted
    expect(rendered).not.toContain('X-Rntme-Audience');
    // and the upstream block is named with the provider index
    expect(rendered).toContain('upstream rntme_auth_tokens__0 {');
  });

  it('rejects audiences containing quote or control characters', () => {
    expect(() =>
      renderNginxConfig(
        {
          routes: [
            {
              id: 'http:/api',
              kind: 'http',
              path: '/api',
              targetService: 'app',
              targetWorkload: 'app',
            },
          ],
          middleware: [
            {
              mountTarget: 'http:/api',
              name: 'auth',
              kind: 'auth',
              providers: [
                {
                  index: 0,
                  provider: 'auth0',
                  audience: 'https://evil.com"; return 200; #',
                  moduleSlug: 'identity-auth0',
                  introspectPath: '/introspect',
                  introspectPort: 50052,
                },
              ],
            },
          ],
        },
        { app: 'http://app:3000', 'identity-auth0': 'http://identity-auth0:50052' },
      ),
    ).toThrow(TypeError);
  });

  it('renders a platform-tokens to auth0 auth_request chain', () => {
    const edge: EdgePlan = {
      routes: [
        {
          id: 'http:/api/projects',
          kind: 'http',
          path: '/api/projects',
          targetService: 'projects',
          targetWorkload: 'projects',
        },
      ],
      middleware: [
        {
          mountTarget: 'http:/api/projects',
          name: 'auth',
          kind: 'auth',
          providers: [
            {
              index: 0,
              provider: 'platform-tokens',
              moduleSlug: 'tokens',
              introspectPath: '/api/tokens/introspect',
              introspectPort: 3000,
            },
            {
              index: 1,
              provider: 'auth0',
              audience: 'https://platform.rntme.com/api',
              moduleSlug: 'identity-auth0',
              introspectPath: '/introspect',
              introspectPort: 50052,
            },
          ],
        },
      ],
    };

    const rendered = renderNginxConfig(edge, {
      projects: 'http://projects:3000',
      tokens: 'http://tokens:3000',
      'identity-auth0': 'http://identity-auth0:50052',
    });

    expect(rendered).toContain('auth_request          /_rntme_auth_chain_http_api_projects__auth_0;');
    expect(rendered).toContain('location = /_rntme_auth_chain_http_api_projects__auth_0');
    expect(rendered).toContain('location = /_rntme_auth_chain_http_api_projects__auth_1');
    expect(rendered).toContain('error_page 401 = /_rntme_auth_chain_http_api_projects__auth_1;');
    expect(rendered).toContain('upstream rntme_auth_tokens__0 {');
    expect(rendered).toContain('upstream rntme_auth_identity-auth0__1 {');
    expect(rendered).toContain('proxy_pass         http://rntme_auth_tokens__0/api/tokens/introspect;');
    expect(rendered).toContain('proxy_pass         http://rntme_auth_identity-auth0__1/introspect;');
    expect(rendered).toContain('proxy_set_header   X-Rntme-Audience   "https://platform.rntme.com/api";');
    expect(rendered).toContain('auth_request_set      $rntme_session_status $upstream_http_x_rntme_session_status;');
    expect(rendered).toContain('proxy_set_header      X-Rntme-Session-Status $rntme_session_status;');
  });
});
