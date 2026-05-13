import { Hono } from 'hono';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompiledArtifact } from '@rntme/ui';
import { buildHtmlShell } from './static-shell.js';

export type UiRuntimeAssetManifest = {
  readonly stylesheets: readonly UiRuntimeStylesheetAsset[];
  readonly fonts: readonly UiRuntimeFontAsset[];
  readonly icons: readonly UiRuntimeImageAsset[];
  readonly images: readonly UiRuntimeImageAsset[];
  readonly staticFiles: readonly UiRuntimeStaticAsset[];
  readonly preloads: readonly UiRuntimePreloadAsset[];
};

export type UiRuntimeAssetBase = {
  readonly id: string;
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly href: string;
};

export type UiRuntimeStylesheetAsset = UiRuntimeAssetBase & {
  readonly order: number;
  readonly media: string;
  readonly scope: 'document';
};

export type UiRuntimeFontAsset = UiRuntimeAssetBase & {
  readonly family: string;
  readonly weight?: string;
  readonly style?: string;
  readonly preload: boolean;
};

export type UiRuntimeImageAsset = UiRuntimeAssetBase & {
  readonly alt?: string;
};

export type UiRuntimeStaticAsset = UiRuntimeAssetBase;

export type UiRuntimePreloadAsset = {
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly href: string;
  readonly as: 'style' | 'font' | 'image' | 'fetch';
  readonly type?: string;
  readonly crossorigin?: 'anonymous' | 'use-credentials';
};

const EMPTY_ASSET_MANIFEST: UiRuntimeAssetManifest = {
  stylesheets: [],
  fonts: [],
  icons: [],
  images: [],
  staticFiles: [],
  preloads: [],
};

export type CreateAppOptions = {
  artifact: CompiledArtifact;
  assetsDir?: string;
  assetManifest?: UiRuntimeAssetManifest;
};

const SHELL_SECURITY_HEADERS = {
  'content-security-policy':
    "default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; connect-src 'self' https:; frame-src https:; img-src 'self' data: https:; font-src 'self'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
} as const;

export function createApp(opts: CreateAppOptions): Hono {
  const assetsDir =
    opts.assetsDir ??
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'build');

  const assetManifest = opts.assetManifest ?? EMPTY_ASSET_MANIFEST;

  const app = new Hono();
  const shell = buildHtmlShell(assetManifest);

  // Serve compiled manifest
  app.get('/_manifest.json', (c) => c.json(opts.artifact.manifest));

  // Serve compiled layouts
  app.get('/_layouts/:name', (c) => {
    const raw = c.req.param('name');
    const name = raw.endsWith('.json') ? raw.slice(0, -5) : raw;
    const layout = opts.artifact.layouts[name];
    if (!layout) return c.notFound();
    return c.json(layout);
  });

  // Serve compiled screens
  app.get('/_screens/:name', (c) => {
    const raw = c.req.param('name');
    const name = raw.endsWith('.json') ? raw.slice(0, -5) : raw;
    const screen = opts.artifact.screens[name];
    if (!screen) return c.notFound();
    return c.json(screen);
  });

  // Serve asset manifest for inspection
  app.get('/_ui-assets.json', (c) => c.json(assetManifest));

  // Static assets — block traversal before Hono normalizes the path
  app.get('/assets/*', (c) => {
    const rawUrl = c.req.raw.url;
    const rawPath = rawUrl.includes('?') ? rawUrl.slice(0, rawUrl.indexOf('?')) : rawUrl;
    const loweredPath = rawPath.toLowerCase();
    if (loweredPath.includes('..') || loweredPath.includes('%2e%2e')) {
      return c.notFound();
    }
    const file = c.req.path.slice('/assets/'.length);
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

  const htmlShell = () => new Response(shell, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      ...SHELL_SECURITY_HEADERS,
    },
  });

  // HTML shell — root
  app.get('/', htmlShell);

  // SPA fallback
  app.get('/*', htmlShell);

  return app;
}
