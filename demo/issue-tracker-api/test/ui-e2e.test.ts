import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/server.js';

describe('demo UI e2e', () => {
  it('serves /ui and /ui/__artifact.json alongside /v1 bindings', async () => {
    const { app, stop } = buildApp();
    try {
      const ui = await app.request('/ui');
      expect(ui.status).toBe(200);
      const artifactRes = await app.request('/ui/__artifact.json');
      expect(artifactRes.status).toBe(200);
      const payload = (await artifactRes.json()) as { artifact: { routes: Record<string, unknown> } };
      expect(Object.keys(payload.artifact.routes)).toContain('/issues');
    } finally {
      await stop();
    }
  });
});
