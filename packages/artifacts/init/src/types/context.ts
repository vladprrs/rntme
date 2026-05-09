import type { EventTypeSpec, PdmResolver } from '@rntme/pdm';

export type InitCrossRefContext = {
  readonly services: readonly string[];
  readonly pdm: PdmResolver;
  readonly eventsByService: Readonly<Record<string, readonly EventTypeSpec[]>>;
  readonly fileExists: (relativePath: string) => boolean;
  readonly readJson: (relativePath: string) => unknown | null;
};
