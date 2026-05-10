import '../dom-setup.js';
import * as React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { RegistryProvider, createOperationRegistry } from '@rntme/contracts-client-runtime-v1';
import { LoginScreen } from '../../../client/components/LoginScreen.js';

describe('LoginScreen', () => {
  afterEach(() => cleanup());

  it('renders a Sign in button that dispatches the Auth0 login operation', () => {
    const registry = createOperationRegistry();
    const login = mock();
    registry.registerModule('@rntme/identity-auth0', 'login', login);

    const view = render(
      <RegistryProvider value={registry}>
        <LoginScreen />
      </RegistryProvider>,
    );

    fireEvent.click(view.getByRole('button', { name: 'Sign in' }));

    expect(login).toHaveBeenCalledWith({});
  });
});
