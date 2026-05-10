export type StageLog = (entry: {
  readonly step: string;
  readonly level: 'error';
  readonly code: string;
  readonly message: string;
}) => void | Promise<void>;

export type StageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly { readonly code: string; readonly message: string }[] };

export async function runStage<T>(
  step: string,
  fn: () => Promise<StageResult<T>>,
  deps: { log: StageLog },
): Promise<StageResult<T>> {
  let r: StageResult<T>;
  try {
    r = await fn();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    await deps.log({ step, level: 'error', code: 'DEPLOY_EXECUTOR_UNCAUGHT', message });
    throw cause;
  }
  if (!r.ok) {
    const first = r.errors[0];
    await deps.log({
      step,
      level: 'error',
      code: first?.code ?? 'DEPLOY_EXECUTOR_UNCAUGHT',
      message: first?.message ?? 'stage failed',
    });
  }
  return r;
}
