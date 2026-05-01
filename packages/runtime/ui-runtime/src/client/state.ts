import { createStateStore } from '@json-render/core';
import type { StateStore } from '@json-render/core';

export type RuntimeStateStoreOptions = {
  initialState?: Record<string, unknown> | undefined;
  readonlyKeys?: string[] | undefined;
};

export function createRuntimeStateStore(opts: RuntimeStateStoreOptions = {}): StateStore {
  const readonlyKeys = new Set(opts.readonlyKeys ?? []);
  const store = createStateStore(opts.initialState ?? {});

  return {
    ...store,
    set(path, value) {
      if (isReadonlyPath(path, readonlyKeys)) return;
      store.set(path, value);
    },
    update(updates) {
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([path]) => !isReadonlyPath(path, readonlyKeys))
      );
      store.update(filtered);
    }
  };
}

function isReadonlyPath(path: string, readonlyKeys: Set<string>): boolean {
  const key = path.startsWith('/') ? path.slice(1).split('/')[0] : path.split('/')[0];
  return key !== undefined && readonlyKeys.has(key);
}
