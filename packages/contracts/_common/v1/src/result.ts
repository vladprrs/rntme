// Canonical Result/Ok/Err algebra for cross-package code.
//
// Lives in @rntme/contracts-common-v1 (a leaf contract package) so any
// layer — contracts, artifacts, deploy, platform, tooling — can adopt it
// without violating the depcruise layering rules. Helpers use the
// array-of-errors shape; callers that want to accumulate single failures
// should wrap with `err([oneError])`.
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly errors: readonly E[] };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(errors: readonly E[]): Err<E> => ({ ok: false, errors });
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok === true;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r.ok === false;
