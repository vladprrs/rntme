import { createHash } from 'node:crypto';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Stable run-id derived from (operationName, client-supplied key). */
export function deriveOperationRunId(operationName: string, clientKey: string): string {
  return sha256Hex(`${operationName}:${clientKey}`);
}
