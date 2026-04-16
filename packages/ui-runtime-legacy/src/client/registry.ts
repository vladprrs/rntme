import * as React from 'react';

// Minimal registry stub. The real @json-render wiring lands when the packages are
// zod@^3 / react@^18 compatible, or when this package upgrades to zod@^4 / react@^19.
// @json-render/core@0.17 declares peerDependency zod@^4 and its type definitions use
// zod@4-only APIs (z.core.$strip) that are incompatible with our workspace zod@^3.23.8.
// For MVP, the Renderer is shimmed in entry.tsx — this registry is a placeholder.

export type RegistryBundle = {
  catalog: unknown;
  registry: Record<string, React.ComponentType<Record<string, unknown>>>;
};

export function buildRegistry(): RegistryBundle {
  // Fallback registry: every component renders its children wrapped in a div.
  const fallback: React.FC<Record<string, unknown>> = (props) => {
    const { children } = props as { children?: React.ReactNode };
    return React.createElement('div', {}, children);
  };
  const registry = new Proxy(
    {} as Record<string, React.ComponentType<Record<string, unknown>>>,
    { get: () => fallback },
  );
  return { catalog: {}, registry };
}
