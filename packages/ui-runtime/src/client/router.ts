export type RouteMatch = {
  pattern: string;
  params: Record<string, string>;
};

export function matchRoute(patterns: string[], path: string): RouteMatch | null {
  // Prefer exact match
  if (patterns.includes(path)) {
    return { pattern: path, params: {} };
  }

  // Try parameterized match
  for (const pattern of patterns) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i]!;
      const pathP = pathParts[i]!;
      if (pp.startsWith(':')) {
        params[pp.slice(1)] = pathP;
      } else if (pp !== pathP) {
        matched = false;
        break;
      }
    }
    if (matched) return { pattern, params };
  }

  return null;
}

export function expandTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key: string) => params[key] ?? `:${key}`);
}
