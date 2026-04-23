import { createHash } from 'node:crypto';

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** Stable run-id derived from (commandName, client-supplied key). */
export function deriveCommandRunId(commandName: string, clientKey: string): string {
  return sha256Hex(`${commandName}:${clientKey}`);
}

/** Stable per-step key derived from (runId, stepIndex). */
export function deriveStepKey(runId: string, stepIndex: number): string {
  return sha256Hex(`${runId}:pre:${stepIndex}`);
}
