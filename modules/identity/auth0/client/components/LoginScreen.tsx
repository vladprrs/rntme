import * as React from 'react';
import { useModuleAction } from '@rntme/contracts-client-runtime-v1';

const MODULE_NAME = '@rntme/identity-auth0';

export function LoginScreen() {
  const login = useModuleAction(MODULE_NAME, 'login');

  return (
    <main>
      <button type="button" onClick={() => void login()}>
        Sign in
      </button>
    </main>
  );
}
