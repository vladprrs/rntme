import type { ModuleBootContext } from '@rntme/ui-runtime/client';

declare global {
  // eslint-disable-next-line no-var
  var gtag: ((...args: unknown[]) => void) | undefined;
  // eslint-disable-next-line no-var
  var dataLayer: unknown[] | undefined;
}

function ensureGtag(measurementId: string): void {
  if (typeof globalThis === 'undefined') return;
  const g = globalThis as typeof globalThis & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  g.dataLayer = g.dataLayer ?? [];
  if (!g.gtag) {
    g.gtag = function gtag(...args: unknown[]): void {
      g.dataLayer!.push(args);
    };
    g.gtag('js', new Date());
    g.gtag('config', measurementId, { send_page_view: false });
  }
}

export function boot(ctx: ModuleBootContext): void {
  const mid = ctx.config.measurementId;
  if (typeof mid !== 'string' || !mid) return;
  ensureGtag(mid);
  if (typeof document !== 'undefined') {
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(mid)}`;
    document.head.appendChild(s);
  }

  ctx.registerOperation('track', (params) => {
    const g = (globalThis as { gtag?: (...a: unknown[]) => void }).gtag;
    g?.('event', params.event, {
      ...(typeof params.props === 'object' && params.props !== null ? params.props : {}),
    });
  });

  ctx.registerOperation('identify', (params) => {
    const g = (globalThis as { gtag?: (...a: unknown[]) => void }).gtag;
    const uid = params.userId;
    g?.('config', mid, {
      user_id: uid === null || uid === undefined || uid === '' ? null : String(uid),
    });
  });

  ctx.state.subscribe('/currentUser', (user) => {
    const g = (globalThis as { gtag?: (...a: unknown[]) => void }).gtag;
    const sub = user && typeof user === 'object' && 'sub' in user ? String((user as { sub: string }).sub) : null;
    g?.('config', mid, { user_id: sub });
  });

  ctx.on('navigate', (e) => {
    const g = (globalThis as { gtag?: (...a: unknown[]) => void }).gtag;
    const loc =
      typeof window !== 'undefined'
        ? `${window.location.origin}${e.path}`
        : `http://localhost${e.path}`;
    g?.('event', 'page_view', { page_location: loc });
  });
}
