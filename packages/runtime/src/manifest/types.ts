import type { Ok } from '@rntme/pdm';
import type { StudioConfig } from './schema.js';

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
  seed?: { enabled?: boolean; path?: string };
  studio?: {
    enabled?: boolean;
    mountPath?: string;
    maxRows?: number;
  };
  modules?: Array<{ name: string; grpc: { address: string }; protoPath: string }>;
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
  seed: { enabled: boolean; path: string };
  studio: StudioConfig;
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
  | 'RUNTIME_MANIFEST_STUDIO_PATH_CONFLICT';

export type ManifestError = {
  code: ManifestErrorCode;
  path: string;
  message: string;
};

type ManifestErr = { ok: false; errors: ManifestError[] };
export type ManifestResult<T> = Ok<T> | ManifestErr;
