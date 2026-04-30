import * as React from 'react';
import { useSyncExternalStore } from 'react';
import { useModuleAction, useStateStore } from '@rntme/ui-runtime/client';

const MODULE_NAME = '@rntme/identity-auth0';

type AuthUser = {
  sub: string;
  email: string | null;
  name: string | null;
};

export type UserBadgeProps = {
  display?: 'email' | 'name';
};

export function UserBadge({ display = 'email' }: UserBadgeProps) {
  const store = useStateStore();
  const user = useSyncExternalStore(
    store.subscribe,
    () => readAuthUser(store.get('/auth/user')),
    () => readAuthUser(store.get('/auth/user')),
  );
  const logout = useModuleAction(MODULE_NAME, 'logout');

  if (!user) return null;

  return (
    <div>
      <span>{formatUser(user, display)}</span>
      <button type="button" onClick={() => void logout()}>
        Logout
      </button>
    </div>
  );
}

function formatUser(user: AuthUser, display: 'email' | 'name'): string {
  if (display === 'name') return user.name ?? user.email ?? user.sub;
  return user.email ?? user.name ?? user.sub;
}

function readAuthUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== 'object') return null;
  const user = value as Partial<AuthUser>;
  if (typeof user.sub !== 'string') return null;
  return value as AuthUser;
}
