import { describe, expect, it } from 'vitest';
import { createRuntimeStateStore } from '../../src/client/state.js';

describe('createRuntimeStateStore', () => {
  it('seeds initialState and protects readonly root keys from set()', () => {
    const store = createRuntimeStateStore({
      initialState: { currentUser: { sub: 'auth0|x' }, notes: [] },
      readonlyKeys: ['currentUser']
    });

    store.set('/currentUser', { sub: 'auth0|evil' });
    store.set('/notes', [{ id: 'n1' }]);

    expect(store.get('/currentUser')).toEqual({ sub: 'auth0|x' });
    expect(store.get('/notes')).toEqual([{ id: 'n1' }]);
  });

  it('protects readonly root keys from batched update()', () => {
    const store = createRuntimeStateStore({
      initialState: { currentUser: { sub: 'auth0|x' }, draft: 'old' },
      readonlyKeys: ['currentUser']
    });

    store.update({
      '/currentUser': { sub: 'auth0|evil' },
      '/draft': 'new'
    });

    expect(store.get('/currentUser')).toEqual({ sub: 'auth0|x' });
    expect(store.get('/draft')).toBe('new');
  });
});
