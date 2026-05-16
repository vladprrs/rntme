import { cliError, type CliError } from '../errors/codes.js';
import { err, isOk, type Result } from '../result.js';
import type { ClientError } from '../api/client.js';
import { sleep } from '../util/sleep.js';

export type LogLine = { readonly level: string; readonly step: string; readonly message: string };

export interface PollUntilTerminalOpts<TStatusResp, TLogsResp> {
  readonly pollIntervalMs?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly printLogs?: boolean | undefined;
  /** Used in the timeout error message (e.g. "deployment watch"). */
  readonly label: string;
  readonly fetchStatus: () => Promise<Result<TStatusResp, ClientError | CliError>>;
  readonly fetchLogsSince: (
    sinceLineId: number,
  ) => Promise<Result<TLogsResp, ClientError | CliError>>;
  readonly isTerminal: (statusResp: TStatusResp) => boolean;
  readonly getLogLines: (logsResp: TLogsResp) => readonly LogLine[];
  readonly getLastLineId: (logsResp: TLogsResp) => number;
}

/**
 * Poll a status endpoint until it reaches a terminal state, interleaving
 * log-line fetches and (optionally) printing them. Both watchers in
 * apps/cli/src/commands/project use this; see F044 for the dedup rationale.
 */
export async function pollUntilTerminal<TStatusResp, TLogsResp>(
  opts: PollUntilTerminalOpts<TStatusResp, TLogsResp>,
): Promise<Result<TStatusResp, ClientError | CliError>> {
  const {
    pollIntervalMs = 2_000,
    timeoutMs,
    printLogs = true,
    label,
    fetchStatus,
    fetchLogsSince,
    isTerminal,
    getLogLines,
    getLastLineId,
  } = opts;

  let sinceLineId = 0;
  const startTime = Date.now();

  while (true) {
    if (timeoutMs !== undefined && Date.now() - startTime > timeoutMs) {
      return err(cliError('CLI_NETWORK_TIMEOUT', `${label} timed out after ${timeoutMs}ms`));
    }

    const status = await fetchStatus();
    if (!isOk(status)) return status;

    const logs = await fetchLogsSince(sinceLineId);
    if (!isOk(logs)) return logs;

    if (printLogs) {
      for (const line of getLogLines(logs.value)) {
        process.stdout.write(`[${line.level}] ${line.step}: ${line.message}\n`);
      }
    }
    sinceLineId = getLastLineId(logs.value);

    if (isTerminal(status.value)) return status;
    await sleep(pollIntervalMs);
  }
}
