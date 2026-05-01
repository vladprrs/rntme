import type { EventTypeSpec, PdmResolver } from '@rntme/pdm';

export function eventTypesForService(
  serviceSlug: string,
  pdmResolver: PdmResolver,
  events: readonly EventTypeSpec[],
): readonly EventTypeSpec[] {
  return events.filter(
    (event) =>
      pdmResolver.resolveEntity(event.aggregateType)?.ownerService ===
      serviceSlug,
  );
}
