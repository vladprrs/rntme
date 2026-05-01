export function renderLanding(params: {
  scheme: string;
  host: string;
  mountPath: string;
}): string {
  const base = `${params.scheme}://${params.host}${params.mountPath}`;
  const eventsUrl = `${base}/hrana/events`;
  const qsmUrl = `${base}/hrana/qsm`;
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>rntme DB Studio</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 16px;color:#222}code{background:#f2f2f2;padding:2px 6px;border-radius:4px}.warn{background:#fff3cd;border:1px solid #ffeeba;padding:10px;border-radius:6px;color:#665}</style>
</head><body>
<h1>rntme DB Studio (dev-only)</h1>
<p>Read-only libSQL Hrana endpoints over this service's databases.</p>
<h2>Event log</h2>
<p>Type: <strong>libSQL Remote (HTTP)</strong><br>URL: <code>${eventsUrl}</code></p>
<h2>Projection DB</h2>
<p>Type: <strong>libSQL Remote (HTTP)</strong><br>URL: <code>${qsmUrl}</code></p>
<h2>How to use</h2>
<ol>
<li>Open <a href="https://libsqlstudio.com">https://libsqlstudio.com</a>.</li>
<li>Create a new connection, type <em>libSQL Remote (HTTP)</em>.</li>
<li>Paste one of the URLs above.</li>
</ol>
<div class="warn">
<strong>Warning:</strong> this endpoint has no authentication. Never enable in production.
It is slated to move behind an admin-panel auth gate in a future spec.
</div>
</body></html>`;
}
