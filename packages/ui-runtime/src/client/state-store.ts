export type StateStore = {
  get(path: string): unknown;
  set(path: string, value: unknown): void;
  reset(prefix: string): void;
  subscribe(prefix: string, cb: () => void): () => void;
};

type Node = { children: Map<string, Node>; value?: { v: unknown }; subs: Set<() => void> };

function segs(path: string): string[] {
  if (path === '/' || path === '') return [];
  return path.replace(/^\//, '').split('/');
}

function ensure(node: Node, path: string[]): Node {
  let cur = node;
  for (const s of path) {
    let next = cur.children.get(s);
    if (!next) {
      next = { children: new Map(), subs: new Set() };
      cur.children.set(s, next);
    }
    cur = next;
  }
  return cur;
}

function findOrNull(node: Node, path: string[]): Node | null {
  let cur: Node | undefined = node;
  for (const s of path) {
    cur = cur?.children.get(s);
    if (!cur) return null;
  }
  return cur;
}

function materialize(node: Node): unknown {
  if (node.value) return node.value.v;
  if (node.children.size === 0) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, child] of node.children) out[k] = materialize(child);
  return out;
}

function notifyAncestors(path: string[], root: Node): void {
  let cur: Node | undefined = root;
  cur.subs.forEach((cb) => cb());
  for (const s of path) {
    cur = cur?.children.get(s);
    if (!cur) return;
    cur.subs.forEach((cb) => cb());
  }
}

export function createStateStore(): StateStore {
  const root: Node = { children: new Map(), subs: new Set() };

  return {
    get(path) {
      const n = findOrNull(root, segs(path));
      return n ? materialize(n) : undefined;
    },
    set(path, value) {
      const parts = segs(path);
      const n = ensure(root, parts);
      n.value = { v: value };
      notifyAncestors(parts, root);
    },
    reset(prefix) {
      const parts = segs(prefix);
      if (parts.length === 0) {
        root.children.clear();
        return;
      }
      const parent = findOrNull(root, parts.slice(0, -1));
      const last = parts[parts.length - 1];
      if (last !== undefined) parent?.children.delete(last);
      notifyAncestors(parts, root);
    },
    subscribe(prefix, cb) {
      const n = ensure(root, segs(prefix));
      n.subs.add(cb);
      return () => n.subs.delete(cb);
    },
  };
}
