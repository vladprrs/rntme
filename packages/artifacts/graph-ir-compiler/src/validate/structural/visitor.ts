import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import type { GraphIrError } from '../../types/result.js';

export type Graph = AuthoringSpecOutput['graphs'][string];
export type Node = Graph['nodes'][number];
export type NodeKind = Node['type'];

/**
 * Shared mutable state populated during a single walk of a graph's nodes.
 * Hooks may read or write fields that they share across phases.
 */
export type GraphCtx = {
  spec: AuthoringSpecOutput;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
  graph: Graph;
  graphKey: string;
  errors: GraphIrError[];
  // Populated by pre-walk hooks, read by per-node and post-walk hooks.
  hasRoot: boolean;
  // Populated during the per-node walk.
  knownIds: Set<string>; // ids of nodes seen so far in this graph (for prior-ref checks)
  nodesById: Map<string, Node>; // every node, by id (built fully by walk-end)
  consumedInputs: Set<string>; // node ids referenced as inputs by some other node
  hasEmit: boolean; // any emit node in this graph
  hasResult: boolean; // any result node in this graph
};

export type GraphLevelCheck = (ctx: GraphCtx) => void;
export type NodeCheck = (node: Node, ctx: GraphCtx) => void;
export type PostWalkCheck = (ctx: GraphCtx) => void;

/**
 * Returns the prior-node id this node consumes via `config.input`, or undefined
 * for nodes that don't take a prior node as input. Used by ref/dag/output-from
 * checks to walk the rowset edges.
 */
export function nodeInputRef(n: Node): string | undefined {
  switch (n.type) {
    case 'filter':
    case 'map':
    case 'reduce':
    case 'sort':
    case 'limit':
    case 'distinct':
    case 'lookupOne':
      return (n.config as { input?: string }).input;
    default:
      return undefined;
  }
}

/**
 * A bundle of hooks contributed by one rule (or module).
 *
 * `nodeByKind` lets a rule register node hooks for specific node kinds only,
 * which avoids re-checking irrelevant nodes. Use `nodeAll` for hooks that must
 * fire on every node (e.g., id/ref checks).
 */
export type CheckBundle = {
  pre?: GraphLevelCheck[];
  nodeAll?: NodeCheck[];
  nodeByKind?: Partial<Record<NodeKind, NodeCheck[]>>;
  post?: PostWalkCheck[];
};

function newCtx(
  spec: AuthoringSpecOutput,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
  graph: Graph,
  graphKey: string,
  errors: GraphIrError[],
): GraphCtx {
  return {
    spec,
    pdm,
    qsm,
    graph,
    graphKey,
    errors,
    hasRoot: false,
    knownIds: new Set(),
    nodesById: new Map(),
    consumedInputs: new Set(),
    hasEmit: false,
    hasResult: false,
  };
}

/**
 * Run a set of hook bundles across every graph in `spec` with a single per-node
 * walk per graph. Returns a flat error array in the order:
 *   for each graph: [pre errors, per-node errors in node order, post errors]
 *
 * Within each phase, hooks fire in registration order (the order bundles are
 * passed in, then within a bundle: pre/post is the order of the array).
 *
 * For per-node hooks: for a given node, `nodeAll` hooks across bundles fire
 * first (in bundle order, then within-bundle order), then `nodeByKind` hooks
 * matching the node's kind fire (same ordering).
 */
export function runStructuralVisitor(
  spec: AuthoringSpecOutput,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
  bundles: CheckBundle[],
): GraphIrError[] {
  // Flatten hooks once. Order matters and is preserved.
  const preChecks: GraphLevelCheck[] = [];
  const nodeAllChecks: NodeCheck[] = [];
  const nodeKindChecks: Map<NodeKind, NodeCheck[]> = new Map();
  const postChecks: PostWalkCheck[] = [];
  for (const b of bundles) {
    if (b.pre) preChecks.push(...b.pre);
    if (b.nodeAll) nodeAllChecks.push(...b.nodeAll);
    if (b.nodeByKind) {
      for (const [kind, checks] of Object.entries(b.nodeByKind) as [NodeKind, NodeCheck[]][]) {
        if (!checks) continue;
        const arr = nodeKindChecks.get(kind);
        if (arr) arr.push(...checks);
        else nodeKindChecks.set(kind, [...checks]);
      }
    }
    if (b.post) postChecks.push(...b.post);
  }

  const errors: GraphIrError[] = [];
  for (const [graphKey, graph] of Object.entries(spec.graphs)) {
    const ctx = newCtx(spec, pdm, qsm, graph, graphKey, errors);
    for (const c of preChecks) c(ctx);
    for (const node of graph.nodes) {
      // Per-node hooks see `knownIds` containing only *prior* nodes, so
      // duplicate-id checks and prior-ref checks both work without needing
      // bundle-internal ordering. The current node is added below, after
      // all per-node hooks have fired for it.
      for (const c of nodeAllChecks) c(node, ctx);
      const kindChecks = nodeKindChecks.get(node.type as NodeKind);
      if (kindChecks) for (const c of kindChecks) c(node, ctx);
      ctx.knownIds.add(node.id);
      ctx.nodesById.set(node.id, node);
      // Built-in role tracking: cheap and globally useful.
      if (node.type === 'emit') ctx.hasEmit = true;
      else if (node.type === 'result') ctx.hasResult = true;
    }
    for (const c of postChecks) c(ctx);
  }
  return errors;
}
