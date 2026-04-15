export type RouteMatch = { pattern: string; params: Record<string, string> };
export type RouteEvent = RouteMatch & { path: string };

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

export type RouterOptions = { patterns: string[]; onRoute: (evt: RouteEvent) => void };

export function createRouter(opts: RouterOptions): Router {
  const onPop = (): void => {
    const path = window.location.pathname || '/';
    const m = matchRoute(opts.patterns, path);
    if (m) opts.onRoute({ ...m, path });
  };
  window.addEventListener('popstate', onPop);

  return {
    navigate(path) {
      const m = matchRoute(opts.patterns, path);
      if (!m) throw new Error(`navigate: no route for ${path}`);
      window.history.pushState({}, '', path);
      opts.onRoute({ ...m, path });
    },
    currentPath() {
      return window.location.pathname || '/';
    },
  };
}
