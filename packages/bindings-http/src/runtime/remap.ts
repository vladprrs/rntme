import type { HttpParameter } from '@rntme/bindings';

export type BindToMap = Record<string, string>;

export function buildBindToMap(parameters: HttpParameter[]): BindToMap {
  const map: BindToMap = {};
  for (const p of parameters) {
    map[p.name] = p.bindTo;
  }
  return map;
}

export function remapToGraphInputs(
  bag: Record<string, unknown>,
  bindToMap: BindToMap,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [httpName, graphInputName] of Object.entries(bindToMap)) {
    if (Object.prototype.hasOwnProperty.call(bag, httpName)) {
      out[graphInputName] = bag[httpName];
    }
  }
  return out;
}
