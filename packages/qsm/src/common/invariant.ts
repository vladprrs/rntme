// Post-validation derive/resolver code operates on `ValidatedQsm`, which
// the validator pipeline guarantees is internally consistent with the PDM
// (known entities, fields, stateMachine present where required). Reaching
// a branch that would violate that guarantee means the validator has a
// bug. Surface it loudly rather than silently dropping work.

export function invariantViolated(detail: string): Error {
  return new Error(`qsm: invariant violated after validation: ${detail}`);
}
