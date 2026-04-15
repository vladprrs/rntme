export type RouteMatch = { pattern: string; params: Record<string, string> };
export type RouteEvent = RouteMatch & { path: string };

/** Strip a mount prefix (e.g. `/ui`) so route patterns stay `/issues`, not `/ui/issues`. */
export function stripMountPath(path: string, mountPath: string): string {
  if (!mountPath || mountPath === '/') return path;
  const m = mountPath.endsWith('/') ? mountPath.slice(0, -1) : mountPath;
  if (path === m) return '/';
  if (path.startsWith(`${m}/`)) return path.slice(m.length) || '/';
  return path;
}

export function fullMountPath(mountPath: string, routePath: string): string {
  if (!mountPath || mountPath === '/') return routePath;
  const m = mountPath.endsWith('/') ? mountPath.slice(0, -1) : mountPath;
  if (routePath === '/') return m || '/';
  return `${m}${routePath}`;
}

export function matchRoute(patterns: string[], path: string): RouteMatch | null {
  const literal = patterns.find((p) => p === path);
  if (literal) return { pattern: literal, params: {} };

  for (const pattern of patterns) {
    const m = matchTemplate(pattern, path);
    if (m) return { pattern, params: m };
  }
  return null;
}

function matchTemplate(pattern: string, path: string): Record<string, string> | null {
  const ps = pattern.split('/').filter(Boolean);
  const xs = path.split('/').filter(Boolean);
  if (ps.length !== xs.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    const x = xs[i];
    if (p === undefined || x === undefined) return null;
    if (p.startsWith(':')) params[p.slice(1)] = x;
    else if (p !== x) return null;
  }
  return params;
}

export function expandTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, name: string) => {
    if (!(name in values)) throw new Error(`expandTemplate: missing value for :${name}`);
    const val = values[name];
    if (val === undefined) throw new Error(`expandTemplate: missing value for :${name}`);
    return val;
  });
}

export type Router = {
  navigate(path: string): void;
  currentPath(): string;
};

export type RouterOptions = {
  patterns: string[];
  onRoute: (evt: RouteEvent) => void;
  /** When set (e.g. `/ui`), browser URLs are `/ui/issues` while patterns stay `/issues`. */
  mountPath?: string | undefined;
};

export function createRouter(opts: RouterOptions): Router {
  const mount = opts.mountPath ?? '';

  const onPop = (): void => {
    const raw = window.location.pathname || '/';
    const stripped = stripMountPath(raw, mount);
    const m = matchRoute(opts.patterns, stripped);
    if (m) opts.onRoute({ ...m, path: raw });
  };
  window.addEventListener('popstate', onPop);

  return {
    navigate(routePath) {
      const m = matchRoute(opts.patterns, routePath);
      if (!m) throw new Error(`navigate: no route for ${routePath}`);
      const full = fullMountPath(mount, routePath);
      window.history.pushState({}, '', full);
      opts.onRoute({ ...m, path: full });
    },
    currentPath() {
      return stripMountPath(window.location.pathname || '/', mount);
    },
  };
}
