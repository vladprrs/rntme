import type { Ok } from '@rntme/pdm';

export type HttpBodyLimitConfig = { enabled?: boolean; maxBytes?: number };
export type HttpRateLimitConfig = { enabled?: boolean; windowMs?: number; max?: number };
export type ValidatedHttpBodyLimitConfig = { enabled: boolean; maxBytes: number };
export type ValidatedHttpRateLimitConfig = { enabled: boolean; windowMs: number; max: number };
export type ModuleGrpcTlsConfig = {
  rootCertPath?: string;
  privateKeyPath?: string;
  certChainPath?: string;
};
export type ManifestModule = {
  name: string;
  grpc: { address: string; tls?: ModuleGrpcTlsConfig };
  protoPath: string;
};

export type ParsedManifest = {
  rntmeVersion: string;
  service: { name: string; version: string };
  surface?: {
    http?: {
      enabled?: boolean;
      port?: number;
      bodyLimit?: HttpBodyLimitConfig;
      rateLimit?: HttpRateLimitConfig;
    };
    grpc?: { enabled?: boolean; port?: number };
  };
  persistence?: {
    mode?: 'ephemeral' | 'persistent';
    eventStorePath?: string;
    qsmPath?: string;
  };
  bus?: { mode?: 'in-memory' };
  auth?: { mode?: 'header'; headerName?: string; actorKind?: string };
  observability?: {
    health?: { path?: string };
    metrics?: { path?: string };
  };
  seed?: { enabled?: boolean; path?: string };
  modules?: ManifestModule[];
};

export type ValidatedManifest = {
  rntmeVersion: { major: number; minor: number; patch: number };
  service: { name: string; version: string };
  surface: {
    http: {
      enabled: boolean;
      port: number;
      bodyLimit: ValidatedHttpBodyLimitConfig;
      rateLimit: ValidatedHttpRateLimitConfig;
    };
    grpc?: { enabled: boolean; port: number } | undefined;
  };
  persistence:
    | { mode: 'ephemeral' }
    | { mode: 'persistent'; eventStorePath: string; qsmPath: string };
  bus: { mode: 'in-memory' };
  auth: { mode: 'header'; headerName: string; actorKind: string };
  observability: {
    health: { path: string };
    metrics: { path: string };
  };
  seed: { enabled: boolean; path: string };
  modules: ManifestModule[];
};

export type ManifestErrorCode =
  | 'MANIFEST_NOT_JSON'
  | 'MANIFEST_NOT_OBJECT'
  | 'MANIFEST_UNKNOWN_KEY'
  | 'MANIFEST_MISSING_FIELD'
  | 'MANIFEST_INVALID_TYPE'
  | 'MANIFEST_INVALID_PORT'
  | 'MANIFEST_INVALID_VERSION'
  | 'MANIFEST_VERSION_MAJOR_MISMATCH'
  | 'MANIFEST_MISSING_EVENT_STORE_PATH'
  | 'MANIFEST_MISSING_QSM_PATH'
  | 'RUNTIME_MANIFEST_DUPLICATE_MODULE_NAME';

export type ManifestError = {
  code: ManifestErrorCode;
  path: string;
  message: string;
};

type ManifestErr = { ok: false; errors: ManifestError[] };
export type ManifestResult<T> = Ok<T> | ManifestErr;
