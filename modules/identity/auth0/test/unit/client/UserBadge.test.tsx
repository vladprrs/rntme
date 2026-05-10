import '../dom-setup.js';
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { createStateStore } from '@json-render/core';
import {
  RegistryProvider,
  StoreProvider,
  createOperationRegistry,
} from '@rntme/contracts-client-runtime-v1';
import { UserBadge } from '../../../client/components/UserBadge.js';

function renderUserBadge(user: Record<string, unknown> | null, display?: 'email' | 'name') {
  const registry = createOperationRegistry();
  const logout = mock();
  registry.registerModule('@rntme/identity-auth0', 'logout', logout);
  const store = createStateStore({ auth: { user } });

  const view = render(
    <StoreProvider value={store}>
      <RegistryProvider value={registry}>
        <UserBadge display={display} />
      </RegistryProvider>
    </StoreProvider>,
  );

  return { ...view, logout };
}

describe('UserBadge', () => {
  afterEach(() => cleanup());

  it('renders nothing when /auth/user is null', () => {
    const { container } = renderUserBadge(null);

    expect(container.childElementCount).toBe(0);
  });

  it('defaults to email, then name, then sub for display text', () => {
    const email = renderUserBadge({ sub: 'auth0|1', email: 'ava@example.test', name: 'Ava' });
    expect(email.getByText('ava@example.test')).not.toBeNull();
    email.unmount();

    const name = renderUserBadge({ sub: 'auth0|2', email: null, name: 'Ben' });
    expect(name.getByText('Ben')).not.toBeNull();
    name.unmount();

    const sub = renderUserBadge({ sub: 'auth0|3', email: null, name: null });
    expect(sub.getByText('auth0|3')).not.toBeNull();
    sub.unmount();
  });

  it('supports display="name"', () => {
    const view = renderUserBadge({ sub: 'auth0|4', email: 'chris@example.test', name: 'Chris' }, 'name');

    expect(view.getByText('Chris')).not.toBeNull();
    expect(view.queryByText('chris@example.test')).toBeNull();
  });

  it('dispatches the Auth0 logout operation', () => {
    const view = renderUserBadge({ sub: 'auth0|5', email: 'dev@example.test', name: null });

    fireEvent.click(view.getByRole('button', { name: 'Logout' }));

    expect(view.logout).toHaveBeenCalledWith({});
  });
});
