import type { CurrentUser } from './types.js';

const STYLE_ID = 'rntme-auth-shell-style';
const CSS = `
.rntme-auth-shell { min-height: 100vh; background: #f8fafc; color: #0f172a; }
.rntme-auth-shell__topbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 20px; border-bottom: 1px solid #dbe2ea; background: #ffffff; }
.rntme-auth-shell__user { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 14px/1.4 system-ui, sans-serif; }
.rntme-auth-shell__runtime { min-height: calc(100vh - 57px); }
.rntme-auth-shell__login { min-height: 100vh; display: grid; place-content: center; gap: 12px; padding: 24px; text-align: center; background: #f8fafc; color: #0f172a; }
.rntme-auth-shell__login h1 { margin: 0; font: 650 28px/1.2 system-ui, sans-serif; }
.rntme-auth-shell__login p { margin: 0; color: #475569; font: 400 15px/1.5 system-ui, sans-serif; }
.rntme-auth-shell button { justify-self: center; min-height: 36px; padding: 0 14px; border: 1px solid #0f172a; border-radius: 6px; background: #0f172a; color: #fff; font: 600 14px/1 system-ui, sans-serif; cursor: pointer; }
.rntme-auth-shell button:focus-visible, .rntme-auth-shell__login button:focus-visible { outline: 3px solid #60a5fa; outline-offset: 2px; }
.rntme-auth-shell__hint { color: #b91c1c; font: 500 14px/1.4 system-ui, sans-serif; }
`;

export function injectStyles(documentRef: Document = document): void {
  if (documentRef.getElementById(STYLE_ID)) return;
  const style = documentRef.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  documentRef.head.appendChild(style);
}

export function renderLogin(target: HTMLElement, onLogin: () => void, message?: string): void {
  injectStyles(target.ownerDocument);
  target.innerHTML = `
    <div class="rntme-auth-shell__login">
      <h1>notes-demo</h1>
      <p>Sign in to view and create notes.</p>
      ${message ? `<p class="rntme-auth-shell__hint" role="status">${escapeHtml(message)}</p>` : ''}
      <button type="button" id="rntme-login-btn">Sign in</button>
    </div>`;

  const button = target.querySelector<HTMLButtonElement>('#rntme-login-btn');
  button?.addEventListener('click', onLogin);
}

export function renderShell(target: HTMLElement, user: CurrentUser, onLogout: () => void): HTMLElement {
  injectStyles(target.ownerDocument);
  target.innerHTML = `
    <div class="rntme-auth-shell">
      <div class="rntme-auth-shell__topbar">
        <span class="rntme-auth-shell__user">${escapeHtml(user.email ?? user.name ?? user.sub)}</span>
        <button type="button" id="rntme-logout-btn" aria-label="Sign out">Logout</button>
      </div>
      <div id="rntme-runtime-root" class="rntme-auth-shell__runtime"></div>
    </div>`;

  const button = target.querySelector<HTMLButtonElement>('#rntme-logout-btn');
  button?.addEventListener('click', onLogout);

  const runtimeRoot = target.querySelector<HTMLElement>('#rntme-runtime-root');
  if (!runtimeRoot) throw new Error('UI_AUTH_SHELL_RUNTIME_ROOT_MISSING');
  return runtimeRoot;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}
