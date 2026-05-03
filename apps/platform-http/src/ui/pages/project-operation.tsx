import { Layout } from '../layout.js';
import { RelativeTime } from '../components/relative-time.js';
import type { AuthSubject, Organization, Project, ProjectOperation, ProjectOperationLogLine } from '@rntme/platform-core';
import type { EnrichedSubject } from './org.js';

export function ProjectOperationPage(props: {
  subject: EnrichedSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  project: Project;
  operation: ProjectOperation;
  logs: readonly ProjectOperationLogLine[];
}) {
  const { subject, project, operation } = props;
  const back = `/${subject.org.slug}/projects/${project.slug}`;
  return (
    <Layout title={`Operation ${operation.id}`} variant="authed" subject={subject as AuthSubject} otherOrgs={props.otherOrgs}>
      <nav class="mb-4 text-sm text-gray-500">
        <a href={`/${subject.org.slug}`} class="hover:underline">Projects</a> <span class="mx-1">/</span>
        <a href={back} class="hover:underline">{project.slug}</a> <span class="mx-1">/</span>
        <span class="text-gray-900">operation</span>
      </nav>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">{operation.kind} operation</h1>
        <p class="break-all text-xs text-gray-500"><code>{operation.id}</code></p>
      </header>
      <section class="mb-6 border-y border-gray-200 py-4">
        <div
          hx-get={`/${subject.org.slug}/projects/${project.slug}/operations/${operation.id}/status`}
          hx-trigger="load, every 2s"
          hx-swap="innerHTML"
        >
          <p class="text-sm">status: <span class="font-medium">{operation.status}</span></p>
        </div>
        <p class="mt-2 text-sm text-gray-600">queued <RelativeTime value={operation.queuedAt} /></p>
        {operation.errorCode ? <p class="mt-2 text-sm text-red-700">{operation.errorCode}: {operation.errorMessage}</p> : null}
      </section>
      <section class="mb-6">
        <h2 class="mb-2 text-sm font-medium text-gray-900">Logs</h2>
        <div
          hx-get={`/${subject.org.slug}/projects/${project.slug}/operations/${operation.id}/logs?sinceLineId=0`}
          hx-trigger="load, every 2s"
          hx-swap="innerHTML"
        >
          <pre class="rounded bg-gray-50 p-3 text-xs">{props.logs.map((line) => `[${line.level}] ${line.step}: ${line.message}`).join('\n')}</pre>
        </div>
      </section>
      <section class="mb-6">
        <h2 class="mb-2 text-sm font-medium text-gray-900">Payload</h2>
        <pre class="rounded bg-gray-50 p-3 text-xs">{JSON.stringify({ input: operation.input, result: operation.result }, null, 2)}</pre>
      </section>
    </Layout>
  );
}
