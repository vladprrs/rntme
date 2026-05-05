// Minimal Result<T, E> shape used by the provisioner contract.
// Mirrors @rntme/deploy-core's Result so a contract value can flow into
// deploy-core helpers (and vice versa) without re-wrapping. Helpers
// (`ok`, `err`, `isOk`, `isErr`) live in deploy-core; this leaf package
// owns only the type so it stays dependency-free.
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly errors: readonly E[] };
export type Result<T, E> = Ok<T> | Err<E>;
