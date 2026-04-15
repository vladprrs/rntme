import type { ResolvedBinding, UiResolvers } from '@rntme/ui';

type BindingsPassthrough = {
  resolvedInputs: ResolvedBinding['inputs'];
  resolvedOutputShape: ResolvedBinding['outputShape'];
};

type ValidatedBindingsLike = {
  bindings: Record<
    string,
    {
      kind: 'query' | 'command';
      http: { method: 'GET' | 'POST'; path: string };
      passthrough: BindingsPassthrough;
    }
  >;
};

export function buildBindingResolver(
  validated: ValidatedBindingsLike,
): UiResolvers['resolveBinding'] {
  return (id: string): ResolvedBinding | undefined => {
    const entry = validated.bindings[id];
    if (!entry) return undefined;
    return {
      kind: entry.kind,
      inputs: entry.passthrough.resolvedInputs,
      outputShape: entry.passthrough.resolvedOutputShape,
      http: entry.http,
    };
  };
}
