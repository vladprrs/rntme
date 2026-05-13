import type { UiRuntimeAssetManifest } from './index.js';

export function buildHtmlShell(assetManifest: UiRuntimeAssetManifest): string {
  const assetTags = renderAssetTags(assetManifest);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rntme</title>
${assetTags}  <link rel="stylesheet" href="/assets/main.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/main.js"></script>
</body>
</html>`;
}

function renderAssetTags(assetManifest: UiRuntimeAssetManifest): string {
  const preloadTags = [
    ...assetManifest.preloads.map((preload) => renderPreload(preload.href, preload.as, preload.type, preload.crossorigin)),
    ...assetManifest.fonts
      .filter((font) => font.preload)
      .map((font) => renderPreload(font.href, 'font', font.href.endsWith('.woff2') ? 'font/woff2' : undefined, 'anonymous')),
  ].sort();

  const stylesheetTags = [...assetManifest.stylesheets]
    .sort((a, b) => a.order - b.order || `${a.moduleKey}:${a.id}`.localeCompare(`${b.moduleKey}:${b.id}`))
    .map((sheet) => `  <link href="${escapeAttr(sheet.href)}" rel="stylesheet" media="${escapeAttr(sheet.media)}">`);

  const tags = [...preloadTags, ...stylesheetTags];
  return tags.length === 0 ? '' : `${tags.join('\n')}\n`;
}

function renderPreload(
  href: string,
  as: string,
  type: string | undefined,
  crossorigin: 'anonymous' | 'use-credentials' | undefined,
): string {
  const attrs = [
    `href="${escapeAttr(href)}"`,
    'rel="preload"',
    `as="${escapeAttr(as)}"`,
    ...(type === undefined ? [] : [`type="${escapeAttr(type)}"`]),
    ...(crossorigin === undefined ? [] : [`crossorigin="${escapeAttr(crossorigin)}"`]),
  ];
  return `  <link ${attrs.join(' ')}>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
