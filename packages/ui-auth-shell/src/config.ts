import type { PublicAuthShellConfig } from './types.js';

const DEFAULT_SCOPE = 'openid profile email';
const FORBIDDEN_AUTH0_KEYS = new Set(['clientSecret', 'client_secret', 'secret']);

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export type LoadAuthShellConfigOptions = {
  baseFetch?: typeof fetch;
  windowConfig?: unknown;
  url?: string;
};

export function parseAuthShellConfig(input: unknown): ParseResult<PublicAuthShellConfig> {
  const errors: string[] = [];
  const value = input as Record<string, unknown> | null;
  const auth0 = asRecord(value?.auth0);
  const runtime = asRecord(value?.runtime);

  for (const key of ['domain', 'clientId', 'audience', 'redirectUri'] as const) {
    if (!isNonEmptyString(auth0?.[key])) {
      errors.push(`auth0.${key} must be a non-empty string`);
    }
  }

  if (!isNonEmptyString(runtime?.manifestUrl)) {
    errors.push('runtime.manifestUrl must be a non-empty string');
  }

  if (auth0) {
    for (const key of Object.keys(auth0)) {
      if (FORBIDDEN_AUTH0_KEYS.has(key)) {
        errors.push(`auth0.${key} is not allowed in public auth shell config`);
      }
    }
  }

  if (auth0?.scope !== undefined && !isNonEmptyString(auth0.scope)) {
    errors.push('auth0.scope must be a non-empty string when provided');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      auth0: {
        domain: auth0!.domain as string,
        clientId: auth0!.clientId as string,
        audience: auth0!.audience as string,
        redirectUri: auth0!.redirectUri as string,
        scope: (auth0!.scope as string | undefined) ?? DEFAULT_SCOPE
      },
      runtime: {
        manifestUrl: runtime!.manifestUrl as string
      }
    }
  };
}

export async function loadAuthShellConfig(
  opts: LoadAuthShellConfigOptions = {}
): Promise<PublicAuthShellConfig> {
  const raw = opts.windowConfig ?? readWindowConfig();
  if (raw !== undefined) return parseOrThrow(raw);

  const fetchImpl = opts.baseFetch ?? fetch;
  const response = await fetchImpl(opts.url ?? '/config.json');
  if (!response.ok) {
    throw new Error(`UI_AUTH_SHELL_CONFIG_FETCH_FAILED: HTTP ${response.status}`);
  }
  return parseOrThrow(await response.json());
}

function parseOrThrow(input: unknown): PublicAuthShellConfig {
  const parsed = parseAuthShellConfig(input);
  if (!parsed.ok) throw new Error(`UI_AUTH_SHELL_CONFIG_INVALID: ${parsed.errors.join('; ')}`);
  return parsed.value;
}

function readWindowConfig(): unknown {
  const maybeWindow = globalThis as typeof globalThis & {
    window?: { __RNTME_AUTH_SHELL_CONFIG__?: unknown };
  };
  return maybeWindow.window?.__RNTME_AUTH_SHELL_CONFIG__;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
