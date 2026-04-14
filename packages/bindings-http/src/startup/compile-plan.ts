import { compile, type CompileResult } from '@rntme/graph-ir-compiler';
import type { Result } from '@rntme/graph-ir-compiler';

export function compileForGraph(
  rawSpec: unknown,
  graphId: string,
  pdm: unknown,
  qsm: unknown,
): Result<CompileResult> {
  const spec = rawSpec as { graphs?: Record<string, unknown>; [k: string]: unknown };
  const graphs = spec?.graphs ?? {};
  const target = graphs[graphId];
  const singleGraphSpec = {
    ...spec,
    graphs: target === undefined ? {} : { [graphId]: target },
  };
  return compile(singleGraphSpec, pdm, qsm);
}
