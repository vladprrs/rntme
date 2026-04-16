import type { Hono } from 'hono';
import type { ValidatedUiArtifact } from '@rntme/ui-legacy';
import type { HttpBindingEntry } from '../resolvers/http-map.js';

export type ArtifactPayloadConfig = {
  bindingsHttpOrigin: string;
  mountPath: string;
  resolvedHttp: Record<string, HttpBindingEntry>;
  defaultHeaders: Record<string, string>;
};

export function mountArtifactRoute(
  app: Hono,
  opts: {
    mountPath: string;
    artifact: ValidatedUiArtifact;
    bindingsHttpOrigin?: string | undefined;
    resolvedHttp?: Record<string, HttpBindingEntry> | undefined;
    defaultHeaders?: Record<string, string> | undefined;
  },
): void {
  const config: ArtifactPayloadConfig = {
    bindingsHttpOrigin: opts.bindingsHttpOrigin ?? '',
    mountPath: opts.mountPath,
    resolvedHttp: opts.resolvedHttp ?? {},
    defaultHeaders: opts.defaultHeaders ?? {},
  };

  app.get(`${opts.mountPath}/__artifact.json`, (c) =>
    c.json({
      artifact: opts.artifact,
      config,
    }),
  );
}
