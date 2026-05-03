import { ok, err, type Result } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuid(value: string, argName: string): Result<string, CliError> {
  if (UUID_RE.test(value)) return ok(value);
  return err(cliError('CLI_VALIDATE_NOT_UUID', `${argName} must be a UUID; got "${value}"`));
}
