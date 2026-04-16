import type { ValidatedPdm, EventTypeSpec } from '@rntme/pdm';
import type { ValidatedQsm, ProjectionDdlSpec } from '@rntme/qsm';
import type { ValidatedBindings, OpenApiDoc } from '@rntme/bindings';
import type { ValidatedUiArtifact } from '@rntme/ui-legacy';
import type { CompiledArtifact } from '@rntme/ui';
import type { ApplyPlan } from '@rntme/projection-consumer';
import type { SeedError, ValidatedSeed } from '@rntme/seed';
import type { ValidatedManifest, ManifestError } from './manifest/types.js';

export type RuntimeOk<T> = { ok: true; value: T };
export type RuntimeErr<E> = { ok: false; errors: E };
export type RuntimeResult<T, E> = RuntimeOk<T> | RuntimeErr<E>;

export type GraphSpec = {
  version: '1.0-rc7';
  pdmRef: string;
  qsmRef: string;
  shapes: Record<string, { fields: Record<string, { type: string; nullable: boolean }> }>;
  graphs: Record<string, unknown>;
};

export type ValidatedService = {
  manifest: ValidatedManifest;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
  bindings: ValidatedBindings;
  ui: ValidatedUiArtifact;
  compiledUi: CompiledArtifact | null;
  graphSpec: GraphSpec;
  openApiDoc: OpenApiDoc;
  projectionApplyPlan: ApplyPlan;
  projectionDdls: readonly ProjectionDdlSpec[];
  eventTypes: readonly EventTypeSpec[];
  seed: ValidatedSeed | null;
};

export type ServiceError =
  | { code: 'MANIFEST_INVALID'; details: ManifestError[] }
  | { code: 'PDM_INVALID'; details: unknown[] }
  | { code: 'QSM_INVALID'; details: unknown[] }
  | { code: 'BINDINGS_INVALID'; details: unknown[] }
  | { code: 'UI_INVALID'; details: unknown[] }
  | { code: 'OPENAPI_INVALID'; details: unknown[] }
  | { code: 'SEED_INVALID'; details: readonly SeedError[] }
  | { code: 'IO_ERROR'; details: { message: string } };

export type RunningService = {
  httpPort: number;
  stop(): Promise<void>;
};
