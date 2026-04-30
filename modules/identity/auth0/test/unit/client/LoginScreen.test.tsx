import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RegistryProvider, createOperationRegistry } from '@rntme/ui-runtime/client';
import { LoginScreen } from '../../../client/components/LoginScreen.js';

describe('LoginScreen', () => {
  afterEach(() => cleanup());

  it('renders a Sign in button that dispatches the Auth0 login operation', () => {
    const registry = createOperationRegistry();
    const login = vi.fn();
    registry.registerModule('@rntme/identity-auth0', 'login', login);

    render(
      <RegistryProvider value={registry}>
        <LoginScreen />
      </RegistryProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(login).toHaveBeenCalledWith({});
  });
});
