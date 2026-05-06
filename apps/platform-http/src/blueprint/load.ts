import { rm } from 'node:fs/promises';
import { loadComposedBlueprint, type ComposedBlueprint } from '@rntme/blueprint';
import {
  err,
  ok,
  type CanonicalBundle,
  type PlatformError,
  type ProjectVersionSummary,
  type Result,
} from '@rntme/platform-core';
import { materializeBundle } from '../bundle/materialize.js';

export type MaterializeResult = {
  readonly composed: ComposedBlueprint;
  readonly summary: ProjectVersionSummary;
  readonly tmpDir: string;
};

export async function materializeAndCompose(
  bundle: CanonicalBundle,
): Promise<Result<MaterializeResult, PlatformError>> {
  const dir = await materializeBundle(bundle);
  try {
    const composed = loadComposedBlueprint(dir);
    if (!composed.ok) {
      return err([
        {
          code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
          message: composed.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
          stage: 'validation',
        },
      ]);
    }

    const project = composed.value.project;
    const summary: ProjectVersionSummary = {
      projectName: project.name,
      services: [...project.services],
      routes: {
        ui: { ...(project.routes?.ui ?? {}) },
        http: { ...(project.routes?.http ?? {}) },
      },
      middleware: { ...(project.middleware ?? {}) },
      mounts: [...(project.mounts ?? [])],
    };

    return ok({ composed: composed.value, summary, tmpDir: dir });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
