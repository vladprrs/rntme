import { readFileSync } from 'node:fs';
import { URL, fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';
import { ACTOR_REF_KINDS } from '../../src/types/actor.js';

describe('ActorRef contract', () => {
  it('keeps actor shape and runtime kinds in sync with @rntme/pdm ActorRef', () => {
    const pdmArtifactPath = fileURLToPath(
      new URL('../../../../artifacts/pdm/src/types/artifact.ts', import.meta.url),
    );
    const eventStoreActorPath = fileURLToPath(new URL('../../src/types/actor.ts', import.meta.url));
    const pdmSource = readFileSync(pdmArtifactPath, 'utf8');
    const eventStoreSource = readFileSync(eventStoreActorPath, 'utf8');
    const pdmVariants = actorVariants(pdmSource);
    const eventStoreVariants = actorVariants(eventStoreSource);
    const pdmKinds = actorKinds(pdmVariants);

    expect(eventStoreVariants).toEqual(pdmVariants);
    expect([...ACTOR_REF_KINDS] as string[]).toEqual(pdmKinds);
  });
});

function actorVariants(source: string): string[] {
  const actorType =
    source.match(/export type ActorRef =([\s\S]*?)(?:\n\n\/\*\*|\nexport )/)?.[1] ?? '';
  return [...actorType.matchAll(/\{([^}]+)\}/g)].map((match) =>
    match[1]!
      .replace(/\breadonly\s+/g, '')
      .replace(/"/g, "'")
      .split(';')
      .map((part) => part.trim().replace(/\s+/g, ' '))
      .filter((part) => part.length > 0)
      .sort()
      .join(';'),
  );
}

function actorKinds(variants: readonly string[]): string[] {
  return variants.map((variant) => variant.match(/kind:\s*'([^']+)'/)?.[1] ?? '');
}
