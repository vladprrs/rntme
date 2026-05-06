import { rm } from 'node:fs/promises';
import type { CanonicalBundle } from '@rntme/platform-core';
import { loadComposedBlueprint } from '../compose/load-composed-blueprint.js';
import type { ComposedBlueprint } from '../types/artifact.js';
import { err, ok, type Result } from '../types/result.js';
import { materializeBundle } from './materialize.js';

export type MaterializeResult = {
  readonly composed: ComposedBlueprint;
  readonly summary: {
    readonly projectName: string;
    readonly services: readonly string[];
    readonly routes: { readonly ui: Record<string, string>; readonly http: Record<string, string> };
    readonly middleware: Record<string, unknown>;
    readonly mounts: readonly { readonly target: string; readonly use: readonly string[] }[];
  };
};

export async function materializeAndCompose(bundle: CanonicalBundle): Promise<Result<MaterializeResult>> {
  let dir: string;
  try {
    dir = await materializeBundle(bundle);
  } catch (cause) {
    return err([
      {
        layer: 'load',
        code: 'BLUEPRINT_IO_ERROR',
        message: cause instanceof Error ? cause.message : String(cause),
        path: '',
      },
    ]);
  }

  try {
    const composed = loadComposedBlueprint(dir);
    if (!composed.ok) return composed;

    const project = composed.value.project;
    const summary: MaterializeResult['summary'] = {
      projectName: project.name,
      services: [...project.services],
      routes: {
        ui: { ...(project.routes?.ui ?? {}) },
        http: { ...(project.routes?.http ?? {}) },
      },
      middleware: { ...(project.middleware ?? {}) },
      mounts: [...(project.mounts ?? [])].map((mount) => ({
        target: mount.target,
        use: [...mount.use],
      })),
    };

    return ok({ composed: composed.value, summary });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
