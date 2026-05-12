import { existsSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import type { ClientAssets } from '@rntme/contracts-module-v1';
import type { UiAssetManifest, UiAssetSource, UiPresetExport } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type BlueprintError, type PropSchema, type Result } from '../types/result.js';
import type { DiscoveredModule } from './modules.js';

const EMPTY_ASSET_MANIFEST: UiAssetManifest = {
  stylesheets: [],
  fonts: [],
  icons: [],
  images: [],
  staticFiles: [],
  preloads: [],
};

type BuildResult = {
  readonly manifest: UiAssetManifest;
  readonly sources: readonly UiAssetSource[];
  readonly presets: readonly UiPresetExport[];
};

export function buildModuleClientSurfaces(discovered: Record<string, DiscoveredModule>): Result<BuildResult> {
  const errors: BlueprintError[] = [];
  const stylesheets: UiStylesheetAsset[] = [];
  const fonts: UiFontAsset[] = [];
  const icons: UiImageAsset[] = [];
  const images: UiImageAsset[] = [];
  const staticFiles: UiStaticAsset[] = [];
  const preloads: UiPreloadAsset[] = [];
  const sources: UiAssetSource[] = [];
  const presets: UiPresetExport[] = [];

  for (const [moduleName, mod] of Object.entries(discovered).sort(([a], [b]) => a.localeCompare(b))) {
    const moduleKey = mod.projectKey;
    const assets = mod.manifest.client?.assets;
    if (assets) {
      collectAssets({
        moduleName,
        moduleKey,
        packageDir: mod.packageDir,
        assets,
        errors,
        stylesheets,
        fonts,
        icons,
        images,
        staticFiles,
        preloads,
        sources,
      });
    }

    for (const preset of mod.manifest.client?.presets ?? []) {
      const sourcePath = safePackagePath(mod.packageDir, `${preset.path}.spec.json`);
      if (sourcePath === null) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_BAD_PATH,
          message: `module "${moduleName}" preset "${preset.name}" path "${preset.path}" must stay inside the package`,
          path: `${moduleName}/module.json:client.presets.${preset.name}`,
        });
        continue;
      }
      if (!isRegularFile(sourcePath)) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_MISSING,
          message: `module "${moduleName}" preset "${preset.name}" expects fragment file "${preset.path}.spec.json"`,
          path: `${moduleName}/module.json:client.presets.${preset.name}`,
        });
        continue;
      }
      presets.push({
        moduleKey,
        moduleName,
        name: preset.name,
        kind: preset.kind,
        path: preset.path,
        ...(preset.description === undefined ? {} : { description: preset.description }),
        inputs: preset.inputs as Record<string, PropSchema>,
        sourcePath,
      });
    }
  }

  const presetKeys = presets.map((preset) => `${preset.moduleKey}:${preset.path}`);
  const duplicatedPresetKeys = presetKeys.filter((key, index) => presetKeys.indexOf(key) !== index);
  if (duplicatedPresetKeys.length > 0) {
    errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_DUPLICATE,
      message: `duplicate module preset exports: ${[...new Set(duplicatedPresetKeys)].join(', ')}`,
      path: 'project.json#modules',
    });
  }

  if (errors.length > 0) return err(errors);

  return ok({
    manifest: {
      stylesheets: [...stylesheets].sort(compareStylesheets),
      fonts: [...fonts].sort(compareByModuleAndId),
      icons: [...icons].sort(compareByModuleAndId),
      images: [...images].sort(compareByModuleAndId),
      staticFiles: [...staticFiles].sort(compareByModuleAndId),
      preloads: [...preloads].sort(comparePreloads),
    },
    sources: [...sources].sort(compareAssetSources),
    presets: [...presets].sort((a, b) => `${a.moduleKey}:${a.path}`.localeCompare(`${b.moduleKey}:${b.path}`)),
  });
}

export function emptyUiAssetManifest(): UiAssetManifest {
  return EMPTY_ASSET_MANIFEST;
}

// Local type aliases for readability inside collectAssets
type UiStylesheetAsset = UiAssetManifest['stylesheets'][number];
type UiFontAsset = UiAssetManifest['fonts'][number];
type UiImageAsset = UiAssetManifest['icons'][number];
type UiStaticAsset = UiAssetManifest['staticFiles'][number];
type UiPreloadAsset = UiAssetManifest['preloads'][number];

function collectAssets(input: {
  moduleName: string;
  moduleKey: string;
  packageDir: string;
  assets: ClientAssets;
  errors: BlueprintError[];
  stylesheets: UiStylesheetAsset[];
  fonts: UiFontAsset[];
  icons: UiImageAsset[];
  images: UiImageAsset[];
  staticFiles: UiStaticAsset[];
  preloads: UiPreloadAsset[];
  sources: UiAssetSource[];
}): void {
  for (const asset of input.assets.stylesheets ?? []) {
    const source = assetSource(input, 'stylesheets', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.stylesheets.push({
      id: asset.id,
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      href: source.href,
      order: asset.order ?? 0,
      media: asset.media ?? 'all',
      scope: asset.scope ?? 'document',
    });
  }

  for (const asset of input.assets.fonts ?? []) {
    const source = assetSource(input, 'fonts', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.fonts.push({
      id: asset.id,
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      href: source.href,
      family: asset.family,
      ...(asset.weight === undefined ? {} : { weight: asset.weight }),
      ...(asset.style === undefined ? {} : { style: asset.style }),
      preload: asset.preload === true,
    });
  }

  for (const asset of input.assets.icons ?? []) {
    const source = assetSource(input, 'icons', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.icons.push({
      id: asset.id,
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      href: source.href,
      ...(asset.alt === undefined ? {} : { alt: asset.alt }),
    });
  }

  for (const asset of input.assets.images ?? []) {
    const source = assetSource(input, 'images', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.images.push({
      id: asset.id,
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      href: source.href,
      ...(asset.alt === undefined ? {} : { alt: asset.alt }),
    });
  }

  for (const asset of input.assets.staticFiles ?? []) {
    const source = assetSource(input, 'staticFiles', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.staticFiles.push({
      id: asset.id,
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      href: source.href,
    });
  }

  const hrefBySourcePath = new Map(input.sources.map((source) => [source.sourceRelativePath, source.href]));
  for (const preload of input.assets.preloads ?? []) {
    const href = hrefBySourcePath.get(preload.path);
    if (href === undefined) {
      const source = assetSource(input, 'staticFiles', safeAssetIdFromPath(preload.path), preload.path);
      if (!source) continue;
      input.sources.push(source);
      input.preloads.push({
        moduleKey: input.moduleKey,
        moduleName: input.moduleName,
        href: source.href,
        as: preload.as,
        ...(preload.type === undefined ? {} : { type: preload.type }),
        ...(preload.crossorigin === undefined ? {} : { crossorigin: preload.crossorigin }),
      });
      continue;
    }
    input.preloads.push({
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      href,
      as: preload.as,
      ...(preload.type === undefined ? {} : { type: preload.type }),
      ...(preload.crossorigin === undefined ? {} : { crossorigin: preload.crossorigin }),
    });
  }
}

function assetSource(
  input: Pick<Parameters<typeof collectAssets>[0], 'moduleName' | 'moduleKey' | 'packageDir' | 'errors'>,
  kind: 'stylesheets' | 'fonts' | 'icons' | 'images' | 'staticFiles',
  id: string,
  relPath: string,
): UiAssetSource | null {
  if (isJavaScriptAsset(relPath)) {
    input.errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED,
      message: `module "${input.moduleName}" client asset "${relPath}" is executable JavaScript; use client.entry instead`,
      path: `${input.moduleName}/module.json:client.assets.${id}`,
    });
    return null;
  }
  const sourcePath = safePackagePath(input.packageDir, relPath);
  if (sourcePath === null) {
    input.errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_ASSET_BAD_PATH,
      message: `module "${input.moduleName}" client asset "${relPath}" must stay inside the package`,
      path: `${input.moduleName}/module.json:client.assets.${id}`,
    });
    return null;
  }
  if (!isRegularFile(sourcePath)) {
    input.errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_ASSET_MISSING,
      message: `module "${input.moduleName}" client asset "${relPath}" is missing on disk`,
      path: `${input.moduleName}/module.json:client.assets.${id}`,
    });
    return null;
  }
  const ext = extname(relPath);
  const runtimePath = `ui-build/modules/${input.moduleKey}/${kind}/${safeAssetId(id)}${ext}`;
  return {
    moduleKey: input.moduleKey,
    moduleName: input.moduleName,
    sourcePath,
    sourceRelativePath: relPath,
    runtimePath,
    href: `/${runtimePath.replace(/^ui-build\//, 'assets/')}`,
  };
}

function safePackagePath(packageDir: string, relPath: string): string | null {
  const root = resolve(packageDir);
  const full = resolve(join(root, relPath));
  const back = relative(root, full);
  if (back === '' || back === '..' || back.startsWith(`..${sep}`)) return null;
  return full;
}

function isRegularFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function isJavaScriptAsset(path: string): boolean {
  return /\.(?:mjs|cjs|js|jsx|ts|tsx)$/i.test(path);
}

function safeAssetId(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-');
}

function safeAssetIdFromPath(path: string): string {
  return safeAssetId(path.replace(/\.[^.]+$/, '').split('/').join('-'));
}

const KIND_ORDER: Record<string, number> = {
  stylesheets: 0,
  fonts: 1,
  icons: 2,
  images: 3,
  staticFiles: 4,
};

function compareAssetSources(a: UiAssetSource, b: UiAssetSource): number {
  // Sort by moduleKey first, then by kind priority, then by path within kind.
  const modCmp = a.moduleKey.localeCompare(b.moduleKey);
  if (modCmp !== 0) return modCmp;
  // Extract kind segment from runtimePath: ui-build/modules/<moduleKey>/<kind>/...
  const kindA = a.runtimePath.split('/')[3] ?? '';
  const kindB = b.runtimePath.split('/')[3] ?? '';
  const kindCmp = (KIND_ORDER[kindA] ?? 99) - (KIND_ORDER[kindB] ?? 99);
  if (kindCmp !== 0) return kindCmp;
  return a.runtimePath.localeCompare(b.runtimePath);
}

function compareStylesheets(a: UiStylesheetAsset, b: UiStylesheetAsset): number {
  return a.order - b.order || compareByModuleAndId(a, b);
}

function compareByModuleAndId(a: { moduleKey: string; id: string }, b: { moduleKey: string; id: string }): number {
  return `${a.moduleKey}:${a.id}`.localeCompare(`${b.moduleKey}:${b.id}`);
}

function comparePreloads(a: UiPreloadAsset, b: UiPreloadAsset): number {
  return `${a.moduleKey}:${a.href}:${a.as}`.localeCompare(`${b.moduleKey}:${b.href}:${b.as}`);
}
