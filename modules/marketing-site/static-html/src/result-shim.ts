export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly E[] };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(...errors: E[]): Result<never, E> => ({ ok: false, errors });
