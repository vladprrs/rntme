export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: readonly E[] };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(...errors: E[]): Result<never, E> => ({ ok: false, errors });
