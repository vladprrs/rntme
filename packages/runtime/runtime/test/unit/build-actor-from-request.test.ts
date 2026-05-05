import { describe, expect, it } from 'vitest';
import type { Context } from 'hono';
import type { ValidatedManifest } from '../../src/manifest/types.js';
import {
  MAX_ACTOR_ID_LENGTH,
  buildActorFromRequest,
  normalizeActorId,
} from '../../src/start/build-actor-from-request.js';

describe('buildActorFromRequest', () => {
  it('normalizes absent, blank, valid, overlong, and unsafe actor IDs', () => {
    expect(normalizeActorId(undefined)).toBeNull();
    expect(normalizeActorId('   ')).toBeNull();
    expect(normalizeActorId(' auth0|user_123 ')).toBe('auth0|user_123');
    expect(normalizeActorId('u'.repeat(MAX_ACTOR_ID_LENGTH + 1))).toBeNull();
    expect(normalizeActorId('auth0|user 123')).toBeNull();
    expect(normalizeActorId('auth0|user;rm')).toBeNull();
  });

  it('returns a validated ActorRef for a valid actor header', () => {
    const actorFromRequest = buildActorFromRequest(manifest);

    expect(actorFromRequest(ctxWithHeader(' auth0|user_123 '))).toEqual({
      kind: 'user',
      id: 'auth0|user_123',
    });
  });

  it('returns null for invalid actor headers', () => {
    const actorFromRequest = buildActorFromRequest(manifest);

    expect(actorFromRequest(ctxWithHeader('auth0|user 123'))).toBeNull();
  });
});

const manifest = {
  auth: { mode: 'header', headerName: 'x-actor-id', actorKind: 'user' },
} as ValidatedManifest;

function ctxWithHeader(value: string | undefined): Context {
  return {
    req: {
      header(name: string): string | undefined {
        return name === 'x-actor-id' ? value : undefined;
      },
    },
  } as unknown as Context;
}
