import type { Hono } from 'hono';
import type { ValidatedUiArtifact } from '@rntme/ui';

export function mountArtifactRoute(
  app: Hono,
  opts: {
    mountPath: string;
    artifact: ValidatedUiArtifact;
    bindingsHttpOrigin?: string | undefined;
  },
): void {
  app.get(`${opts.mountPath}/__artifact.json`, (c) =>
    c.json({
      artifact: opts.artifact,
      config: { bindingsHttpOrigin: opts.bindingsHttpOrigin ?? '' },
    }),
  );
}
