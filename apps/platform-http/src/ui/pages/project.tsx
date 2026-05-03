import { Layout } from '../layout.js';
import { DataTable } from '../components/table.js';
import { EmptyState } from '../components/empty-state.js';
import { RelativeTime } from '../components/relative-time.js';
import type { AuthSubject, DeployTarget, Organization, Project, ProjectOperation, ProjectVersion } from '@rntme/platform-core';
import type { EnrichedSubject } from './org.js';

export function ProjectPage(props: {
  subject: EnrichedSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  project: Project;
  versions: readonly ProjectVersion[];
  deployTargets?: readonly DeployTarget[];
  operations?: readonly ProjectOperation[];
}) {
  const { subject, project, versions } = props;
  const back = `/${subject.org.slug}`;
  return (
    <Layout title={project.displayName} variant="authed" subject={subject as AuthSubject} otherOrgs={props.otherOrgs}>
      <nav class="mb-4 text-sm text-gray-500">
        <a href={back} class="hover:underline">Projects</a> <span class="mx-1">/</span>
        <span class="text-gray-900">{project.slug}</span>
      </nav>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">{project.displayName}</h1>
        <p class="text-sm text-gray-600">
          Slug: <code class="rounded bg-gray-100 px-1">{project.slug}</code>
          <span class="ml-3 rounded border border-gray-300 px-2 py-0.5 text-xs">{project.status}</span>
        </p>
      </header>
      <section class="mb-6 border-y border-gray-200 py-4">
        <h2 class="mb-3 text-sm font-medium text-gray-900">Operations</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <form method="post" action={`/${subject.org.slug}/projects/${project.slug}/operations/update`} class="space-y-3">
            <label class="block text-sm">
              <span class="mb-1 block font-medium text-gray-900">Version</span>
              <select name="projectVersionSeq" required class="w-full rounded border border-gray-300 px-2 py-1">
                {versions.map((version) => <option value={String(version.seq)}>{`#${version.seq}`}</option>)}
              </select>
            </label>
            <label class="block text-sm">
              <span class="mb-1 block font-medium text-gray-900">Target</span>
              <select name="targetSlug" required class="w-full rounded border border-gray-300 px-2 py-1">
                {(props.deployTargets ?? []).map((target) => <option value={target.slug}>{target.displayName}</option>)}
              </select>
            </label>
            <button type="submit" class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700">Update</button>
          </form>
          <form method="post" action={`/${subject.org.slug}/projects/${project.slug}/operations/delete`} class="space-y-3">
            <label class="block text-sm">
              <span class="mb-1 block font-medium text-gray-900">Confirm slug</span>
              <input name="confirm" required value={project.slug} class="w-full rounded border border-gray-300 px-2 py-1" />
            </label>
            <button type="submit" class="rounded border border-red-700 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">Delete</button>
          </form>
        </div>
        {(props.operations ?? []).length > 0 ? (
          <ul class="mt-4 divide-y divide-gray-200 text-sm">
            {(props.operations ?? []).map((operation) => (
              <li class="py-2">
                <a href={`/${subject.org.slug}/projects/${project.slug}/operations/${operation.id}`} class="font-medium text-blue-700 hover:underline">{operation.kind}</a>
                <span class="ml-2 text-gray-600">{operation.status}</span>
                <span class="ml-2 text-gray-500"><RelativeTime value={operation.queuedAt} /></span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <h2 class="mb-2 text-sm font-medium text-gray-900">Project versions</h2>
      {versions.length === 0 ? (
        <EmptyState
          title="No versions yet."
          hint="Publish a blueprint with the CLI:"
          code="rntme project publish --create-project"
        />
      ) : (
        <DataTable
          headers={['Seq', 'Digest', 'Services', 'Uploaded']}
          rows={versions.map((v) => ({
            key: v.id,
            cells: [
              <a
                href={`/${subject.org.slug}/projects/${project.slug}/versions/${v.seq}`}
                class="font-medium text-blue-700 hover:underline"
              >
                {`#${v.seq}`}
              </a>,
              <code class="text-xs text-gray-500">{v.bundleDigest.slice(0, 17)}...</code>,
              String(v.summary.services.length),
              <RelativeTime value={v.createdAt} />,
            ],
          }))}
        />
      )}
    </Layout>
  );
}
