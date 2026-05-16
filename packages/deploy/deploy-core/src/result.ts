import type { DeploymentPlanError } from './errors.js';
import type {
  Ok as CommonOk,
  Err as CommonErr,
  Result as CommonResult,
} from '@rntme/contracts-common-v1/result';

export { ok, err, isOk, isErr } from '@rntme/contracts-common-v1/result';

export type Ok<T> = CommonOk<T>;
export type Err<E> = CommonErr<E>;
export type Result<T, E = DeploymentPlanError> = CommonResult<T, E>;
