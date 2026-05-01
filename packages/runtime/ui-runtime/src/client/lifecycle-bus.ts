export type LifecycleEvents = {
  navigate: { path: string; params: Record<string, string> };
  'action:dispatched': { actionId: string; kind: string; params: Record<string, unknown> };
  'action:succeeded': { actionId: string; kind: string; result: unknown };
  'action:failed': { actionId: string; kind: string; status?: number; error: unknown };
};

export type LifecycleBus = {
  on<K extends keyof LifecycleEvents>(
    event: K,
    handler: (e: LifecycleEvents[K]) => void,
  ): () => void;
  emit<K extends keyof LifecycleEvents>(event: K, payload: LifecycleEvents[K]): void;
};

export function createLifecycleBus(): LifecycleBus {
  const handlers = new Map<keyof LifecycleEvents, Set<(e: unknown) => void>>();
  return {
    on(event, handler) {
      let set = handlers.get(event);
      if (!set) {
        set = new Set();
        handlers.set(event, set);
      }
      set.add(handler as (e: unknown) => void);
      return () => {
        set?.delete(handler as (e: unknown) => void);
      };
    },
    emit(event, payload) {
      handlers.get(event)?.forEach((h) => h(payload));
    },
  };
}
