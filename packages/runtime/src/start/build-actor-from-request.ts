import type { Context } from 'hono';
import type { ActorRef } from '@rntme/event-store';
import type { ValidatedManifest } from '../manifest/types.js';

export function buildActorFromRequest(
  manifest: ValidatedManifest,
): (c: Context) => ActorRef | null {
  const headerName = manifest.auth.headerName;
  const kind = manifest.auth.actorKind;
  return (c: Context) => {
    const id = c.req.header(headerName);
    if (id === undefined || id === '') return null;
    return { kind, id } as ActorRef;
  };
}
