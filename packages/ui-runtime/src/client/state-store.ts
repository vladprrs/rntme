export type StateStore = {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  update(changes: Record<string, unknown>): void;
  getSnapshot(): Record<string, unknown>;
  subscribe(listener: () => void): () => void;
};

export function createStateStore(): StateStore {
  const data: Record<string, unknown> = {};
  let snapshot: Record<string, unknown> = {};
  const listeners = new Set<() => void>();

  function notify(): void {
    snapshot = { ...data };
    for (const fn of listeners) fn();
  }

  return {
    get: (path) => data[path],
    set: (path, value) => {
      data[path] = value;
      notify();
    },
    update: (changes) => {
      Object.assign(data, changes);
      notify();
    },
    getSnapshot: () => snapshot,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  };
}
