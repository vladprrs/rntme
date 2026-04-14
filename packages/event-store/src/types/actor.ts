/**
 * Runtime actor reference carried in event envelope (spec §3.3).
 * Redeclared locally to keep @rntme/event-store free of PDM dependency.
 * Shape MUST match @rntme/pdm's ActorRef exactly.
 */
export type ActorRef =
  | { readonly kind: 'user'; readonly id: string }
  | { readonly kind: 'system'; readonly id: string }
  | { readonly kind: 'service'; readonly id: string };
