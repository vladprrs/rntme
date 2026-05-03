import type { ProjectOperation } from '@rntme/platform-core';

export function ProjectOperationStatusFragment(props: { operation: ProjectOperation }) {
  const { operation } = props;
  return (
    <div>
      <p class="text-sm">status: <span class="font-medium">{operation.status}</span></p>
      {operation.errorCode ? <p class="mt-1 text-sm text-red-700">{operation.errorCode}: {operation.errorMessage}</p> : null}
    </div>
  );
}
