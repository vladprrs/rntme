import type { TerminalResult } from '@rntme/deploy-runner';

export type DirectRunResult = {
  readonly target: string;
  readonly project: string;
  readonly terminal: TerminalResult;
};

export function renderHumanReport(r: DirectRunResult): string {
  if (r.terminal.ok) {
    return `✓ deployment succeeded\n  project:  ${r.project}\n  target:   ${r.target}`;
  }
  return [
    `✗ deployment failed`,
    `  project:  ${r.project}`,
    `  target:   ${r.target}`,
    `  code:     ${r.terminal.errorCode}`,
    `  message:  ${r.terminal.errorMessage}`,
  ].join('\n');
}
