// Re-export the canonical Result/Ok/Err algebra from @rntme/contracts-common-v1.
// Kept as a re-export shim so existing `@rntme/artifact-shared` importers
// (bindings, deploy-runner, blueprint, runtime, …) don't need to change.
// See docs/goals/simplify-monorepo-audit (Q10/F057).
export { ok, err, isOk, isErr } from '@rntme/contracts-common-v1/result';
export type { Ok, Err, Result } from '@rntme/contracts-common-v1/result';
