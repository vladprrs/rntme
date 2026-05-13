import type { ValidatedPdm, EventTypeSpec } from '@rntme/pdm';
import type { ValidatedQsm, ProjectionDdlSpec } from '@rntme/qsm';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import type { CompiledArtifact } from '@rntme/ui';
import type { ApplyPlan } from '@rntme/projection-consumer';
import type { SeedError, ValidatedSeed } from '@rntme/seed';
import type { ValidatedManifest, ManifestError } from './manifest/types.js';
import type { AuthoringSpecOutput } from '@rntme/graph-ir-compiler';
import type { UiRuntimeAssetManifest } from '@rntme/ui-runtime';

export type RuntimeOk<T> = { ok: true; value: T };
export type RuntimeErr<E> = { ok: false; errors: E };
export type RuntimeResult<T, E> = RuntimeOk<T> | RuntimeErr<E>;

export type GraphSpec = AuthoringSpecOutput;

export type ValidatedService = {
  artifactDir: string;
  manifest: ValidatedManifest;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
  bindings: ValidatedBindings;
  compiledUi: CompiledArtifact;
  uiAssetsDir: string | null;
  uiAssetManifest: UiRuntimeAssetManifest | null;
  graphSpec: GraphSpec;
  openApiDoc: OpenApiDoc;
  projectionApplyPlan: ApplyPlan;
  projectionDdls: readonly ProjectionDdlSpec[];
  eventTypes: readonly EventTypeSpec[];
  seed: ValidatedSeed | null;
};

export type ServiceError =
  | { code: 'MANIFEST_INVALID'; details: readonly ManifestError[] }
  | { code: 'PDM_INVALID'; details: readonly unknown[] }
  | { code: 'QSM_INVALID'; details: readonly unknown[] }
  | { code: 'GRAPH_INVALID'; details: readonly unknown[] }
  | { code: 'BINDINGS_INVALID'; details: readonly unknown[] }
  | { code: 'UI_INVALID'; details: readonly unknown[] }
  | { code: 'OPENAPI_INVALID'; details: readonly unknown[] }
  | { code: 'SEED_INVALID'; details: readonly SeedError[] }
  | { code: 'DERIVED_PROJECTION_INVALID'; details: readonly unknown[] }
  | { code: 'IO_ERROR'; details: { message: string } };

export type RunningService = {
  httpPort: number;
  grpcPort?: number | undefined;
  stop(): Promise<void>;
};
