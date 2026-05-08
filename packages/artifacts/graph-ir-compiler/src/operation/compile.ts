import { deriveEventTypes, type ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { normalize } from '../canonical/normalize.js';
import { parseGraphIrArtifacts } from '../explain/explain.js';
import { parseAuthoringSpec } from '../parse/parse.js';
import type { AuthoringSpecOutput } from '../parse/schema.js';
import { validateStructural } from '../validate/structural/index.js';
import { validateSemantic } from '../validate/semantic/index.js';
import { validateOperationEffects } from '../validate/effects.js';
import { ERROR_CODES, err, ok, type Result } from '../types/result.js';
import { toGraphIrError } from '../types/errors.js';
import type { Exposure } from '../types/effects.js';
import type { CompiledOperation, OperationRegistry, OperationRegistryEntry } from '../types/operation.js';

export type CompileOperationOptions = Readonly<{
  registry: OperationRegistry;
  serviceName: string;
  ownedAggregates: ReadonlySet<string>;
  exposure: Exposure;
}>;

export function compileOperation(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  opts: CompileOperationOptions,
): Result<CompiledOperation> {
  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return specR;

  const pq = parseGraphIrArtifacts(rawPdm, rawQsm);
  if (!pq.ok) return pq;

  return compileOperationFromValidated(specR.value, pq.value.pdm, pq.value.qsm, opts);
}

export function compileOperationFromValidated(
  spec: AuthoringSpecOutput,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
  opts: CompileOperationOptions,
): Result<CompiledOperation> {
  void opts.serviceName;

  const sv = validateStructural(spec, pdm, qsm);
  if (!sv.ok) return sv;

  let canonical;
  try {
    canonical = normalize(sv.value);
  } catch (e) {
    return err([toGraphIrError(e, 'canonical')]);
  }

  const graphIds = Object.keys(canonical.graphs);
  if (graphIds.length !== 1) {
    return err([
      {
        layer: 'canonical',
        code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID,
        message: 'compileOperation accepts exactly one graph',
      },
    ]);
  }

  const graph = canonical.graphs[graphIds[0]!]!;
  const semR = validateSemantic(graph, pdm, qsm, sv.value.shapes);
  if (!semR.ok) return semR;

  const eventTypes = new Map(
    deriveEventTypes(pdm).map((event) => [
      `${event.aggregateType}.${event.transition}`,
      event.eventType,
    ]),
  );

  const effects = validateOperationEffects({
    graph,
    registry: opts.registry,
    ownedAggregates: opts.ownedAggregates,
    eventTypesByAggregateTransition: eventTypes,
    exposure: opts.exposure,
  });
  if (!effects.ok) return effects;

  const registryEntriesByNodeId: Record<string, OperationRegistryEntry> = {};
  for (const node of graph.nodes) {
    if (node.kind !== 'call') continue;
    const entry = opts.registry.resolve(node.target);
    if (entry !== null) registryEntriesByNodeId[node.id] = entry;
  }

  return ok({
    graphId: graph.id,
    graph,
    effects: effects.value,
    registryEntriesByNodeId,
    resultNodeId: graph.outputFrom,
    pdm,
    qsm,
  });
}
