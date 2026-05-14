export function readOutputPath(root: Record<string, unknown>, path: string): unknown {
  let cur: unknown = root;
  for (const part of pathTokens(path)) {
    if (cur === null || cur === undefined) return null;

    if (typeof part === 'number') {
      if (!Array.isArray(cur)) return null;
      cur = cur[part];
      continue;
    }

    if (typeof cur !== 'object') return null;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur ?? null;
}

function pathTokens(path: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  for (const segment of path.split('.')) {
    const re = /([^[\]]+)|\[(\d+)\]/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(segment)) !== null) {
      if (match[1] !== undefined) tokens.push(match[1]);
      else tokens.push(Number(match[2]));
    }
  }
  return tokens;
}
