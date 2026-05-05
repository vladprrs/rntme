import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStateStore } from '@json-render/core';
import {
  RegistryProvider,
  StoreProvider,
  createOperationRegistry,
} from '@rntme/contracts-client-runtime-v1';
import { UserBadge } from '../../../client/components/UserBadge.js';

function renderUserBadge(user: Record<string, unknown> | null, display?: 'email' | 'name') {
  const registry = createOperationRegistry();
  const logout = vi.fn();
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

    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to email, then name, then sub for display text', () => {
    const email = renderUserBadge({ sub: 'auth0|1', email: 'ava@example.test', name: 'Ava' });
    expect(email.getByText('ava@example.test')).toBeInTheDocument();
    email.unmount();

    const name = renderUserBadge({ sub: 'auth0|2', email: null, name: 'Ben' });
    expect(name.getByText('Ben')).toBeInTheDocument();
    name.unmount();

    const sub = renderUserBadge({ sub: 'auth0|3', email: null, name: null });
    expect(sub.getByText('auth0|3')).toBeInTheDocument();
  });

  it('supports display="name"', () => {
    renderUserBadge({ sub: 'auth0|4', email: 'chris@example.test', name: 'Chris' }, 'name');

    expect(screen.getByText('Chris')).toBeInTheDocument();
    expect(screen.queryByText('chris@example.test')).not.toBeInTheDocument();
  });

  it('dispatches the Auth0 logout operation', () => {
    const { logout } = renderUserBadge({ sub: 'auth0|5', email: 'dev@example.test', name: null });

    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));

    expect(logout).toHaveBeenCalledWith({});
  });
});
