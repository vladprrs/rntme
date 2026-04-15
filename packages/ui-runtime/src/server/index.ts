import { Hono } from 'hono';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ValidatedUiArtifact } from '@rntme/ui';
import { buildHtmlShell } from './static-shell.js';
import { mountArtifactRoute } from './artifact-route.js';

export type CreateUiAppOptions = {
  artifact: ValidatedUiArtifact;
  mountPath?: string | undefined;
  bindingsHttpOrigin?: string | undefined;
  assetsDir?: string | undefined;
};

export function createUiApp(opts: CreateUiAppOptions): Hono {
  const mountPath = opts.mountPath ?? '/ui';
  const assetsDir =
    opts.assetsDir ??
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'build');

  const app = new Hono();
  const shell = buildHtmlShell({ mountPath });

  app.get(mountPath, (c) => c.html(shell));
  mountArtifactRoute(app, {
    mountPath,
    artifact: opts.artifact,
    ...(opts.bindingsHttpOrigin !== undefined
      ? { bindingsHttpOrigin: opts.bindingsHttpOrigin }
      : {}),
  });

  app.get(`${mountPath}/assets/:file`, (c) => {
    const file = c.req.param('file');
    const resolvedAssetsDir = resolve(assetsDir);
    const fp = resolve(resolvedAssetsDir, file);
    if (fp !== resolvedAssetsDir && !fp.startsWith(resolvedAssetsDir + sep)) {
      return c.notFound();
    }
    if (!existsSync(fp)) return c.notFound();
    const buf = readFileSync(fp);
    const isJs = file.endsWith('.js');
    const isCss = file.endsWith('.css');
    return c.body(buf as unknown as ArrayBuffer, 200, {
      'content-type': isJs
        ? 'application/javascript'
        : isCss
          ? 'text/css'
          : 'application/octet-stream',
    });
  });

  // SPA fallback: anything under mountPath not matched above returns the shell.
  app.get(`${mountPath}/*`, (c) => c.html(shell));

  return app;
}
