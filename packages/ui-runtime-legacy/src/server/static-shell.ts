export function buildHtmlShell(options: { mountPath: string }): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>rntme UI</title>
    <link rel="stylesheet" href="${options.mountPath}/assets/main.css" />
  </head>
  <body>
    <div id="root"></div>
    <script>window.__RNTME_UI_MOUNT__=${JSON.stringify(options.mountPath)};</script>
    <script type="module" src="${options.mountPath}/assets/main.js"></script>
  </body>
</html>`;
}
