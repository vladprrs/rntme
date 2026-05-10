import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

export type IntrospectionHttpHarness = {
  /** Base URL of a running HTTP introspection server (e.g. http://localhost:50052). */
  readonly baseUrl: string;
  /** Audience the server is configured to accept. */
  readonly audience: string;
  /** A token the server will introspect as ACTIVE. */
  readonly validToken: string;
  /** A token the server will reject. */
  readonly invalidToken: string;
  /** Callback to start the harness; resolves to baseUrl/audience/tokens. Called once per suite. */
  readonly setup?: () => Promise<void>;
  /** Callback to tear the harness down. Called once per suite. */
  readonly teardown?: () => Promise<void>;
};

export function runIntrospectionHttpConformance(label: string, makeHarness: () => IntrospectionHttpHarness): void {
  describe(`HTTP introspection conformance — ${label}`, () => {
    const h = makeHarness();

    beforeAll(async () => {
      if (h.setup !== undefined) await h.setup();
    });
    afterAll(async () => {
      if (h.teardown !== undefined) await h.teardown();
    });

    it('rejects requests with no Authorization header', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { 'X-Rntme-Audience': h.audience },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('IDENTITY_HTTP_TOKEN_MISSING');
    });

    it('rejects requests with no X-Rntme-Audience header', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { Authorization: `Bearer ${h.validToken}` },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('IDENTITY_HTTP_AUDIENCE_MISSING');
    });

    it('rejects malformed Authorization (no Bearer prefix)', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { Authorization: `Token ${h.validToken}`, 'X-Rntme-Audience': h.audience },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('IDENTITY_HTTP_TOKEN_MISSING');
    });

    it('rejects an invalid token', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { Authorization: `Bearer ${h.invalidToken}`, 'X-Rntme-Audience': h.audience },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('IDENTITY_CONSISTENCY_INVALID_TOKEN');
    });

    it('returns 200 + X-Rntme-User-* headers on a valid token', async () => {
      const res = await fetch(`${h.baseUrl}/introspect`, {
        headers: { Authorization: `Bearer ${h.validToken}`, 'X-Rntme-Audience': h.audience },
      });
      expect(res.status).toBe(200);
      const sub = res.headers.get('X-Rntme-User-Sub');
      expect(sub).toBeTruthy();
      expect(res.headers.get('X-Rntme-User-Audience')).toBe(h.audience);
      expect(res.headers.get('X-Rntme-Session-Status')).toBe('ACTIVE');
    });
  });
}
