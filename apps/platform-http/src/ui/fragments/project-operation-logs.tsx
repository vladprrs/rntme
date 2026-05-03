import type { ProjectOperationLogLine } from '@rntme/platform-core';

export function ProjectOperationLogsFragment(props: {
  lines: readonly ProjectOperationLogLine[];
  lastLineId: number;
}) {
  return (
    <pre class="rounded bg-gray-50 p-3 text-xs" data-last-line-id={String(props.lastLineId)}>
      {props.lines.map((line) => `[${line.level}] ${line.step}: ${line.message}`).join('\n')}
    </pre>
  );
}
