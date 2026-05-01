/**
 * Runtime actor reference carried in event envelope (spec §3.3).
 * Redeclared locally to keep @rntme/event-store free of PDM dependency.
 * Shape MUST match @rntme/pdm's ActorRef exactly.
 */
export const ACTOR_REF_KINDS = ['user', 'system', 'service'] as const;

export type ActorRef =
  | { readonly kind: 'user'; readonly id: string }
  | { readonly kind: 'system'; readonly id: string }
  | { readonly kind: 'service'; readonly id: string };

export type ActorRefKind = ActorRef['kind'];

export function isActorRefKind(kind: string): kind is ActorRefKind {
  return (ACTOR_REF_KINDS as readonly string[]).includes(kind);
}
