import type { Ok } from '@rntme/pdm';

export type ParsedManifest = {
  rntmeVersion: string;
  service: { name: string; version: string };
  surface?: { http?: { enabled?: boolean; port?: number } };
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
  seed?: { path: string };
};

export type ValidatedManifest = {
  rntmeVersion: { major: number; minor: number; patch: number };
  service: { name: string; version: string };
  surface: { http: { enabled: boolean; port: number } };
  persistence:
    | { mode: 'ephemeral' }
    | { mode: 'persistent'; eventStorePath: string; qsmPath: string };
  bus: { mode: 'in-memory' };
  auth: { mode: 'header'; headerName: string; actorKind: string };
  observability: {
    health: { path: string };
    metrics: { path: string };
  };
  seed: { path: string } | null;
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
  | 'MANIFEST_MISSING_QSM_PATH';

export type ManifestError = {
  code: ManifestErrorCode;
  path: string;
  message: string;
};

type ManifestErr = { ok: false; errors: ManifestError[] };
export type ManifestResult<T> = Ok<T> | ManifestErr;
