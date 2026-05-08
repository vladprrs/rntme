export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; errors: readonly E[] };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(errors: readonly E[]): Err<E> => ({ ok: false, errors });
export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;
