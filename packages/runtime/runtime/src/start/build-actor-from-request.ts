import type { Context } from 'hono';
import type { ActorRef } from '@rntme/event-store';
import type { ValidatedManifest } from '../manifest/types.js';

export const MAX_ACTOR_ID_LENGTH = 256;

const ACTOR_ID_PATTERN = /^[A-Za-z0-9._:@|/+=$,-]+$/;

export function buildActorFromRequest(
  manifest: ValidatedManifest,
): (c: Context) => ActorRef | null {
  const headerName = manifest.auth.headerName;
  const kind = manifest.auth.actorKind;
  return (c: Context) => {
    const id = normalizeActorId(c.req.header(headerName));
    if (id === null) return null;
    return { kind, id } as ActorRef;
  };
}

export function normalizeActorId(id: string | undefined): string | null {
  if (id === undefined) return null;
  const trimmed = id.trim();
  if (trimmed === '' || trimmed.length > MAX_ACTOR_ID_LENGTH) return null;
  if (!ACTOR_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}
