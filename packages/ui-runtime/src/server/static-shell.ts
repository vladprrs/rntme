export type BuildHtmlShellOptions = {
  authShell?: boolean | undefined;
};

export function buildHtmlShell(opts: BuildHtmlShellOptions = {}): string {
  const script = opts.authShell
    ? `<script>
  fetch('/config.json').then(function (res) {
    if (!res.ok) throw new Error('config.json HTTP ' + res.status);
    return res.json();
  }).then(function (cfg) {
    window.__RNTME_AUTH_SHELL_CONFIG__ = cfg;
    var script = document.createElement('script');
    script.type = 'module';
    script.src = '/assets/app.js';
    document.body.appendChild(script);
  }).catch(function (err) {
    var root = document.getElementById('root');
    if (root) root.textContent = err instanceof Error ? err.message : String(err);
  });
  </script>`
    : '<script type="module" src="/assets/main.js"></script>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rntme</title>
  <link rel="stylesheet" href="/assets/main.css">
</head>
<body>
  <div id="root"></div>
  ${script}
</body>
</html>`;
}
