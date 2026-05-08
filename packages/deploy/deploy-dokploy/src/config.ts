import type { DokployDeploymentError } from './errors.js';
import { err, ok, type Result } from './result.js';

export type DokployTargetConfig = {
  readonly endpoint: string;
  readonly projectId?: string;
  readonly projectName?: string;
  readonly allowCreateProject?: boolean;
  readonly publicBaseUrl: string;
};

/** Config with `endpoint` and `publicBaseUrl` normalized for stable render and smoke URLs. */
export type NormalizedDokployTargetConfig = DokployTargetConfig;

type UrlField = 'endpoint' | 'publicBaseUrl';

export function validateDokployTargetConfig(config: DokployTargetConfig): Result<NormalizedDokployTargetConfig> {
  const endpoint = normalizeTargetHttpUrl(config.endpoint, 'endpoint');
  const publicBaseUrl = normalizeTargetHttpUrl(config.publicBaseUrl, 'publicBaseUrl');
  if (!endpoint.ok || !publicBaseUrl.ok) {
    const failures: DokployDeploymentError[] = [];
    if (!endpoint.ok) failures.push(...endpoint.errors);
    if (!publicBaseUrl.ok) failures.push(...publicBaseUrl.errors);
    return err(failures);
  }
  return ok({
    ...config,
    endpoint: endpoint.value,
    publicBaseUrl: publicBaseUrl.value,
  });
}

function normalizeTargetHttpUrl(raw: string, field: UrlField): Result<string, DokployDeploymentError> {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return err([
      {
        code: 'DEPLOY_DOKPLOY_INVALID_TARGET_URL',
        message:
          field === 'endpoint'
            ? 'Dokploy endpoint is required and must be a non-empty http(s) URL'
            : 'publicBaseUrl is required and must be a non-empty http(s) URL',
        path: field,
      },
    ]);
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return err([
      {
        code: 'DEPLOY_DOKPLOY_INVALID_TARGET_URL',
        message:
          field === 'endpoint'
            ? 'Dokploy endpoint is not a valid absolute URL'
            : 'publicBaseUrl is not a valid absolute URL',
        path: field,
      },
    ]);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return err([
      {
        code: 'DEPLOY_DOKPLOY_INVALID_TARGET_URL',
        message:
          field === 'endpoint'
            ? 'Dokploy endpoint must use http or https'
            : 'publicBaseUrl must use http or https',
        path: field,
      },
    ]);
  }

  if (url.hostname === '') {
    return err([
      {
        code: 'DEPLOY_DOKPLOY_INVALID_TARGET_URL',
        message:
          field === 'endpoint'
            ? 'Dokploy endpoint must include a host'
            : 'publicBaseUrl must include a host',
        path: field,
      },
    ]);
  }

  if (url.username !== '' || url.password !== '') {
    return err([
      {
        code: 'DEPLOY_DOKPLOY_INVALID_TARGET_URL',
        message:
          field === 'endpoint'
            ? 'Dokploy endpoint must not embed user credentials in the URL'
            : 'publicBaseUrl must not embed user credentials in the URL',
        path: field,
      },
    ]);
  }

  if (url.search !== '' || url.hash !== '') {
    return err([
      {
        code: 'DEPLOY_DOKPLOY_INVALID_TARGET_URL',
        message:
          field === 'endpoint'
            ? 'Dokploy endpoint must not include a query string or fragment'
            : 'publicBaseUrl must not include a query string or fragment',
        path: field,
      },
    ]);
  }

  return ok(serializedStableHttpUrl(url));
}

/** Stable serialization: drop trailing slash on root; trim trailing slash on paths. */
function serializedStableHttpUrl(url: URL): string {
  const path = url.pathname;
  if (path === '/' || path === '') {
    return `${url.protocol}//${url.host}`;
  }
  const withoutTrailingSlash = path.endsWith('/') ? path.slice(0, -1) : path;
  return `${url.protocol}//${url.host}${withoutTrailingSlash}`;
}
