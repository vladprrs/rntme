> **Path note:** paths in this document reflect the pre-merge layout (`rntme-cli/packages/...`, `@rntme-cli/*`). After the merge-back PR lands they move per `2026-04-30-merge-rntme-cli-back-design.md` (e.g. `apps/platform-http`, `packages/deploy/deploy-core`, `@rntme/platform-core`).

# platform-http UI — Plan 03: Read-Only Browse Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four browse pages — projects list, project detail (services), service detail (versions), audit log. After this plan, an authenticated user can navigate from `/` → org → project → service → versions, and view the audit log.

**Architecture:** Each page is a single GET handler inside `createUiApp`. Handlers open an org-scoped tx (already done by `openOrgScopedTx` middleware), resolve repos via `resolveDeps`, and call existing use-cases from `@rntme-cli/platform-core`. All rendering is server-side via the JSX components from Plan 02. No client JS beyond htmx (which is not used here — reload-only in this plan).

**Tech Stack:** Hono JSX, `@rntme-cli/platform-core` use-cases (`listProjects`, `listServices`, versions list, audit list, `projects.findBySlug`, `services.findBySlug`), `Intl.RelativeTimeFormat` for dates.

**Spec:** `docs/superpowers/specs/done/2026-04-21-platform-http-ui-design.md` §5, §7, §8.1, §8.4.

---

### Task 3.1: Shared components — `DataTable`, `EmptyState`, `RelativeTime`

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/components/table.tsx`
- Create: `rntme-cli/packages/platform-http/src/ui/components/empty-state.tsx`
- Create: `rntme-cli/packages/platform-http/src/ui/components/relative-time.tsx`
- Test: `rntme-cli/packages/platform-http/test/unit/ui/components.test.tsx`

- [ ] **Step 1: Write failing test**

Create `test/unit/ui/components.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { DataTable } from '../../../src/ui/components/table.js';
import { EmptyState } from '../../../src/ui/components/empty-state.js';
import { RelativeTime } from '../../../src/ui/components/relative-time.js';

describe('DataTable', () => {
  it('renders a header row and body rows', () => {
    const html = String(
      <DataTable
        headers={['Slug', 'Name']}
        rows={[
          { key: 'a', cells: ['acme', 'Acme'] },
          { key: 'b', cells: ['beta', 'Beta'] },
        ]}
      />,
    );
    expect(html).toContain('<table');
    expect(html).toContain('Slug');
    expect(html).toContain('Name');
    expect(html).toContain('acme');
    expect(html).toContain('Beta');
  });
});

describe('EmptyState', () => {
  it('renders title and hint', () => {
    const html = String(<EmptyState title="No projects yet" hint="Run rntme project create." />);
    expect(html).toContain('No projects yet');
    expect(html).toContain('rntme project create');
  });
});

describe('RelativeTime', () => {
  it('renders ISO datetime attribute and relative text', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000); // 1h ago
    const html = String(<RelativeTime value={past} />);
    expect(html).toContain(`datetime="${past.toISOString()}"`);
    expect(html).toMatch(/ago|hour/i);
  });

  it('handles null', () => {
    const html = String(<RelativeTime value={null} />);
    expect(html).toContain('—');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/components.test.tsx`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement `DataTable`**

Create `src/ui/components/table.tsx`:

```tsx
export type DataRow = {
  key: string;
  cells: readonly (string | number | JSX.Element)[];
};

export function DataTable(props: { headers: readonly string[]; rows: readonly DataRow[] }) {
  return (
    <div class="overflow-hidden rounded-md border border-gray-200 bg-white">
      <table class="w-full text-sm">
        <thead class="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            {props.headers.map((h) => (
              <th scope="col" class="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {props.rows.map((r) => (
            <tr key={r.key}>
              {r.cells.map((cell) => (
                <td class="px-3 py-2 align-top">{cell as JSX.Element}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implement `EmptyState`**

Create `src/ui/components/empty-state.tsx`:

```tsx
export function EmptyState(props: { title: string; hint?: string; code?: string }) {
  return (
    <div class="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center">
      <p class="text-sm font-medium text-gray-900">{props.title}</p>
      {props.hint && <p class="mt-1 text-sm text-gray-600">{props.hint}</p>}
      {props.code && (
        <pre class="mx-auto mt-3 inline-block rounded bg-gray-100 px-3 py-1 text-xs text-gray-800">
          {props.code}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement `RelativeTime`**

Create `src/ui/components/relative-time.tsx`:

```tsx
const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: readonly { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

function relative(value: Date, now: Date = new Date()): string {
  const diff = value.getTime() - now.getTime();
  const abs = Math.abs(diff);
  for (const u of UNITS) {
    if (abs >= u.ms) {
      return RTF.format(Math.round(diff / u.ms), u.unit);
    }
  }
  return 'just now';
}

export function RelativeTime(props: { value: Date | string | null | undefined }) {
  if (!props.value) return <span class="text-gray-400">—</span>;
  const d = typeof props.value === 'string' ? new Date(props.value) : props.value;
  const iso = d.toISOString();
  return (
    <time datetime={iso} title={iso} class="text-gray-600">
      {relative(d)}
    </time>
  );
}
```

- [ ] **Step 6: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/unit/ui/components.test.tsx`
Expected: 4 passing.

- [ ] **Step 7: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/components packages/platform-http/test/unit/ui/components.test.tsx
git commit -m "feat(platform-http): add DataTable, EmptyState, RelativeTime"
```

---

### Task 3.2: `OrgPage` + route

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/pages/org.tsx`
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx` (add route, `requireOrgMatch`, org listing)
- Test: extend `rntme-cli/packages/platform-http/test/e2e/ui-auth.test.ts` OR create `test/e2e/ui-browse.test.ts`

- [ ] **Step 1: Write failing e2e test**

Create `test/e2e/ui-browse.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import { bootE2e, type E2eEnv } from './harness.js';
import { e2eContainersAvailable } from './docker-available.js';

describe.skipIf(!e2eContainersAvailable())('UI browse pages', () => {
  let env: E2eEnv;
  let bearer: string;
  let orgSlug: string;

  beforeAll(async () => {
    env = await bootE2e();
    const o = await env.deps.poolRepos.organizations.upsertFromWorkos({
      workosOrganizationId: 'org_ui',
      slug: 'ui-org',
      displayName: 'UI Org',
    });
    const a = await env.deps.poolRepos.accounts.upsertFromWorkos({
      workosUserId: 'user_ui',
      email: 'ui@example.com',
      displayName: 'UI User',
    });
    if (!o.ok || !a.ok) throw new Error('seed failed');
    await env.deps.poolRepos.memberships.upsert({ orgId: o.value.id, accountId: a.value.id, role: 'admin' });
    const plain = 'rntme_pat_' + 'b'.repeat(22);
    const hash = new Uint8Array(createHash('sha256').update(plain).digest());
    await env.deps.poolRepos.tokens.create({
      id: randomUUID(),
      orgId: o.value.id,
      accountId: a.value.id,
      name: 'ui-test',
      tokenHash: hash,
      prefix: plain.slice(0, 12),
      scopes: ['project:read', 'project:write', 'version:publish', 'member:read', 'token:manage'],
      expiresAt: null,
    });
    bearer = plain;
    orgSlug = o.value.slug;

    // seed a project via API
    const H = { 'content-type': 'application/json', authorization: `Bearer ${bearer}` };
    await env.app.request(`/v1/orgs/${orgSlug}/projects`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ slug: 'proj-a', displayName: 'Project A' }),
    });
  }, 300_000);

  afterAll(async () => env.teardown());

  it('GET /{orgSlug} authed → 200 with project slug', async () => {
    const r = await env.app.request(`/${orgSlug}`, {
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('proj-a');
    expect(body).toContain('Project A');
  });

  it('GET /{wrongOrg} authed → 403 HTML', async () => {
    const r = await env.app.request('/some-other-org', {
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(r.status).toBe(403);
    expect(r.headers.get('content-type')).toMatch(/text\/html/);
  });

  it('GET /{orgSlug} unauth → 302 /login', async () => {
    const r = await env.app.request(`/${orgSlug}`);
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/login');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-browse.test.ts`
Expected: FAIL — `/:orgSlug` route does not exist.

- [ ] **Step 3: Implement `OrgPage`**

Create `src/ui/pages/org.tsx`:

```tsx
import { Layout } from '../layout.js';
import { DataTable } from '../components/table.js';
import { EmptyState } from '../components/empty-state.js';
import { RelativeTime } from '../components/relative-time.js';
import type { AuthSubject, Organization, ProjectListItem } from '@rntme-cli/platform-core';

export function OrgPage(props: {
  subject: AuthSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  projects: readonly ProjectListItem[];
  flash?: string | undefined;
}) {
  const { subject, projects } = props;
  return (
    <Layout title={subject.org.displayName} variant="authed" subject={subject} otherOrgs={props.otherOrgs} flash={props.flash}>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">Projects</h1>
        <p class="text-sm text-gray-600">All active projects in {subject.org.displayName}.</p>
      </header>
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet."
          hint="Create one with the CLI:"
          code={`rntme platform project create <slug>`}
        />
      ) : (
        <DataTable
          headers={['Slug', 'Name', 'Updated']}
          rows={projects.map((p) => ({
            key: p.id,
            cells: [
              <a href={`/${subject.org.slug}/projects/${p.slug}`} class="font-medium text-blue-700 hover:underline">
                {p.slug}
              </a>,
              p.displayName,
              <RelativeTime value={p.updatedAt ?? p.createdAt} />,
            ],
          }))}
        />
      )}
    </Layout>
  );
}
```

- [ ] **Step 4: Add `/:orgSlug` route in `ui/app.tsx`**

The existing `requireOrgMatch` middleware returns JSON 403 on mismatch — for UI we need HTML, so inline the slug check inside the handler.

In `src/ui/app.tsx`, add imports:

```tsx
import { listProjects } from '@rntme-cli/platform-core';
import { OrgPage } from './pages/org.js';
```

Inside `authed` (after the `/no-org` route), add:

```tsx
  authed.get('/:orgSlug', async (c) => {
    const repos = resolveDeps(c.get('tx'));
    const s = c.get('subject');
    const urlSlug = c.req.param('orgSlug');
    if (s.org.slug !== urlSlug) {
      return renderHtml(
        c,
        <ErrorPage status={403} title="Not authorized" detail="You don't have access to this organization." backHref={`/${s.org.slug}`} />,
        403,
      );
    }
    const flash = c.req.query('flash') ?? undefined;
    const [projRes, otherRes] = await Promise.all([
      listProjects({ repos: { projects: repos.projects } }, { orgId: s.org.id, includeArchived: false }),
      repos.organizations.listForAccount(s.account.id),
    ]);
    if (!projRes.ok) {
      return renderHtml(c, <ErrorPage status={500} title="Error" detail={projRes.error.message} />, 500);
    }
    const otherOrgs = isOk(otherRes) ? otherRes.value.filter((o) => o.slug !== s.org.slug) : [];
    return renderHtml(c, <OrgPage subject={s} otherOrgs={otherOrgs} projects={projRes.value} flash={flash} />);
  });
```

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-browse.test.ts`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/pages/org.tsx packages/platform-http/src/ui/app.tsx packages/platform-http/test/e2e/ui-browse.test.ts
git commit -m "feat(platform-http): add /:orgSlug projects list page"
```

---

### Task 3.3: `ProjectPage` + route

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/pages/project.tsx`
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx`
- Test: extend `test/e2e/ui-browse.test.ts`

- [ ] **Step 1: Extend e2e test**

Append to `test/e2e/ui-browse.test.ts` inside the `describe` block. First, in `beforeAll`, add a service seed after the project creation:

```ts
    await env.app.request(`/v1/orgs/${orgSlug}/projects/proj-a/services`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ slug: 'svc-x', displayName: 'Service X' }),
    });
```

Then append these cases:

```ts
  it('GET /{orgSlug}/projects/{projSlug} → 200 with services', async () => {
    const r = await env.app.request(`/${orgSlug}/projects/proj-a`, {
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('Project A');
    expect(body).toContain('svc-x');
    expect(body).toContain('Service X');
  });

  it('GET /{orgSlug}/projects/missing → 404 HTML', async () => {
    const r = await env.app.request(`/${orgSlug}/projects/nope`, {
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(r.status).toBe(404);
    expect(r.headers.get('content-type')).toMatch(/text\/html/);
  });
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-browse.test.ts`
Expected: the new cases FAIL; others still pass.

- [ ] **Step 3: Implement `ProjectPage`**

Create `src/ui/pages/project.tsx`:

```tsx
import { Layout } from '../layout.js';
import { DataTable } from '../components/table.js';
import { EmptyState } from '../components/empty-state.js';
import { RelativeTime } from '../components/relative-time.js';
import type {
  AuthSubject,
  Organization,
  Project,
  ServiceListItem,
} from '@rntme-cli/platform-core';

export function ProjectPage(props: {
  subject: AuthSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  project: Project;
  services: readonly ServiceListItem[];
}) {
  const { subject, project, services } = props;
  const back = `/${subject.org.slug}`;
  return (
    <Layout title={project.displayName} variant="authed" subject={subject} otherOrgs={props.otherOrgs}>
      <nav class="mb-4 text-sm text-gray-500">
        <a href={back} class="hover:underline">Projects</a> <span class="mx-1">/</span>
        <span class="text-gray-900">{project.slug}</span>
      </nav>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">{project.displayName}</h1>
        <p class="text-sm text-gray-600">Slug: <code class="rounded bg-gray-100 px-1">{project.slug}</code></p>
      </header>
      <h2 class="mb-2 text-sm font-medium text-gray-900">Services</h2>
      {services.length === 0 ? (
        <EmptyState
          title="No services yet."
          hint="Create one with the CLI:"
          code={`rntme platform service create ${project.slug} <slug>`}
        />
      ) : (
        <DataTable
          headers={['Slug', 'Name', 'Latest version', 'Updated']}
          rows={services.map((s) => ({
            key: s.id,
            cells: [
              <a
                href={`/${subject.org.slug}/projects/${project.slug}/services/${s.slug}`}
                class="font-medium text-blue-700 hover:underline"
              >
                {s.slug}
              </a>,
              s.displayName,
              s.latestVersionSeq ? `#${s.latestVersionSeq}` : '—',
              <RelativeTime value={s.updatedAt ?? s.createdAt} />,
            ],
          }))}
        />
      )}
    </Layout>
  );
}
```

- [ ] **Step 4: Add route in `ui/app.tsx`**

Add imports:

```tsx
import { listServices } from '@rntme-cli/platform-core';
import { ProjectPage } from './pages/project.js';
```

Add route inside `authed` (after `/:orgSlug`):

```tsx
  authed.get('/:orgSlug/projects/:projSlug', async (c) => {
    const repos = resolveDeps(c.get('tx'));
    const s = c.get('subject');
    if (s.org.slug !== c.req.param('orgSlug')) {
      return renderHtml(
        c,
        <ErrorPage status={403} title="Not authorized" detail="You don't have access to this organization." backHref={`/${s.org.slug}`} />,
        403,
      );
    }
    const projSlug = c.req.param('projSlug')!;
    const projLookup = await repos.projects.findBySlug(s.org.id, projSlug);
    if (!isOk(projLookup) || !projLookup.value) {
      return renderHtml(
        c,
        <ErrorPage status={404} title="Project not found" detail={`No project with slug "${projSlug}".`} backHref={`/${s.org.slug}`} />,
        404,
      );
    }
    const [svcRes, otherRes] = await Promise.all([
      listServices({ repos: { services: repos.services } }, { orgId: s.org.id, projectId: projLookup.value.id }),
      repos.organizations.listForAccount(s.account.id),
    ]);
    if (!svcRes.ok) {
      return renderHtml(c, <ErrorPage status={500} title="Error" detail={svcRes.error.message} />, 500);
    }
    const otherOrgs = isOk(otherRes) ? otherRes.value.filter((o) => o.slug !== s.org.slug) : [];
    return renderHtml(c, <ProjectPage subject={s} otherOrgs={otherOrgs} project={projLookup.value} services={svcRes.value} />);
  });
```

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-browse.test.ts`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/pages/project.tsx packages/platform-http/src/ui/app.tsx packages/platform-http/test/e2e/ui-browse.test.ts
git commit -m "feat(platform-http): add project detail page"
```

---

### Task 3.4: `ServicePage` + route

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/pages/service.tsx`
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx`
- Test: extend `test/e2e/ui-browse.test.ts`

- [ ] **Step 1: Extend e2e test**

In `beforeAll` after service creation, add a publish step (uses the existing `minimalValidBundle` fixture):

```ts
    const minimal = (await import('../../../platform-core/test/fixtures/bundles/minimal-valid.js')).minimalValidBundle;
    await env.app.request(`/v1/orgs/${orgSlug}/projects/proj-a/services/svc-x/versions`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ bundle: minimal, moveTags: ['stable'] }),
    });
```

Append test:

```ts
  it('GET /{orgSlug}/projects/{projSlug}/services/{svcSlug} → 200 with version', async () => {
    const r = await env.app.request(`/${orgSlug}/projects/proj-a/services/svc-x`, {
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('Service X');
    expect(body).toContain('#1');
    expect(body).toContain('stable');
  });
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-browse.test.ts`
Expected: new case FAILS.

- [ ] **Step 3: Implement `ServicePage`**

Create `src/ui/pages/service.tsx`:

```tsx
import { Layout } from '../layout.js';
import { DataTable } from '../components/table.js';
import { EmptyState } from '../components/empty-state.js';
import { RelativeTime } from '../components/relative-time.js';
import type {
  AuthSubject,
  Organization,
  Project,
  Service,
  VersionListItem,
  TagRow,
} from '@rntme-cli/platform-core';

export function ServicePage(props: {
  subject: AuthSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  project: Project;
  service: Service;
  versions: readonly VersionListItem[];
  tags: readonly TagRow[];
}) {
  const { subject, project, service, versions, tags } = props;
  return (
    <Layout title={service.displayName} variant="authed" subject={subject} otherOrgs={props.otherOrgs}>
      <nav class="mb-4 text-sm text-gray-500">
        <a href={`/${subject.org.slug}`} class="hover:underline">Projects</a> <span class="mx-1">/</span>
        <a href={`/${subject.org.slug}/projects/${project.slug}`} class="hover:underline">{project.slug}</a>
        <span class="mx-1">/</span>
        <span class="text-gray-900">{service.slug}</span>
      </nav>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">{service.displayName}</h1>
        <p class="text-sm text-gray-600">Slug: <code class="rounded bg-gray-100 px-1">{service.slug}</code></p>
      </header>

      {tags.length > 0 && (
        <section class="mb-6">
          <h2 class="mb-2 text-sm font-medium text-gray-900">Tags</h2>
          <ul class="flex flex-wrap gap-2 text-sm">
            {tags.map((t) => (
              <li class="rounded-full border border-gray-200 bg-white px-2 py-1">
                <span class="font-medium">{t.name}</span> → #{t.versionSeq}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 class="mb-2 text-sm font-medium text-gray-900">Versions</h2>
      {versions.length === 0 ? (
        <EmptyState
          title="No versions published yet."
          hint="Publish with the CLI:"
          code={`rntme platform publish --service ${project.slug}/${service.slug}`}
        />
      ) : (
        <DataTable
          headers={['#', 'Bundle digest', 'Published']}
          rows={versions.map((v) => ({
            key: String(v.seq),
            cells: [
              `#${v.seq}`,
              <code class="text-xs text-gray-600">{v.bundleDigest.slice(0, 12)}…</code>,
              <RelativeTime value={v.publishedAt} />,
            ],
          }))}
        />
      )}
    </Layout>
  );
}
```

- [ ] **Step 4: Add route in `ui/app.tsx`**

Add imports:

```tsx
import { listVersions, listTags, getServiceDetail } from '@rntme-cli/platform-core';
import { ServicePage } from './pages/service.js';
```

Add route inside `authed`:

```tsx
  authed.get('/:orgSlug/projects/:projSlug/services/:svcSlug', async (c) => {
    const repos = resolveDeps(c.get('tx'));
    const s = c.get('subject');
    if (s.org.slug !== c.req.param('orgSlug')) {
      return renderHtml(
        c,
        <ErrorPage status={403} title="Not authorized" backHref={`/${s.org.slug}`} />,
        403,
      );
    }
    const projSlug = c.req.param('projSlug')!;
    const svcSlug = c.req.param('svcSlug')!;
    const projLookup = await repos.projects.findBySlug(s.org.id, projSlug);
    if (!isOk(projLookup) || !projLookup.value) {
      return renderHtml(
        c,
        <ErrorPage status={404} title="Project not found" backHref={`/${s.org.slug}`} />,
        404,
      );
    }
    const svcLookup = await repos.services.findBySlug(projLookup.value.id, svcSlug);
    if (!isOk(svcLookup) || !svcLookup.value) {
      return renderHtml(
        c,
        <ErrorPage status={404} title="Service not found" backHref={`/${s.org.slug}/projects/${projSlug}`} />,
        404,
      );
    }
    const [versRes, tagsRes, otherRes] = await Promise.all([
      listVersions({ repos: { artifacts: repos.artifacts } }, { serviceId: svcLookup.value.id, limit: 50 }),
      listTags({ repos: { tags: repos.tags } }, { serviceId: svcLookup.value.id }),
      repos.organizations.listForAccount(s.account.id),
    ]);
    if (!versRes.ok) {
      return renderHtml(c, <ErrorPage status={500} title="Error" detail={versRes.error.message} />, 500);
    }
    const otherOrgs = isOk(otherRes) ? otherRes.value.filter((o) => o.slug !== s.org.slug) : [];
    return renderHtml(
      c,
      <ServicePage
        subject={s}
        otherOrgs={otherOrgs}
        project={projLookup.value}
        service={svcLookup.value}
        versions={versRes.value.items ?? versRes.value}
        tags={isOk(tagsRes) ? tagsRes.value : []}
      />,
    );
  });
```

Note: `listVersions` returns `{ items, nextCursor }` per `platform-core`; the `??` fallback handles either shape. Inspect `platform-core` source during impl and pick the exact shape.

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-browse.test.ts`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/pages/service.tsx packages/platform-http/src/ui/app.tsx packages/platform-http/test/e2e/ui-browse.test.ts
git commit -m "feat(platform-http): add service detail page with versions and tags"
```

---

### Task 3.5: `AuditPage` + route

**Files:**
- Create: `rntme-cli/packages/platform-http/src/ui/pages/audit.tsx`
- Modify: `rntme-cli/packages/platform-http/src/ui/app.tsx`
- Test: extend `test/e2e/ui-browse.test.ts`

- [ ] **Step 1: Extend e2e test**

Append:

```ts
  it('GET /{orgSlug}/audit → 200 HTML', async () => {
    const r = await env.app.request(`/${orgSlug}/audit`, {
      headers: { authorization: `Bearer ${bearer}` },
    });
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('Audit');
  });
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-browse.test.ts`
Expected: new case FAILS (route absent).

- [ ] **Step 3: Implement `AuditPage`**

Create `src/ui/pages/audit.tsx`:

```tsx
import { Layout } from '../layout.js';
import { DataTable } from '../components/table.js';
import { EmptyState } from '../components/empty-state.js';
import { RelativeTime } from '../components/relative-time.js';
import type { AuthSubject, Organization, AuditEvent } from '@rntme-cli/platform-core';

export function AuditPage(props: {
  subject: AuthSubject;
  otherOrgs: readonly Pick<Organization, 'id' | 'slug' | 'displayName'>[];
  events: readonly AuditEvent[];
}) {
  const { subject, events } = props;
  return (
    <Layout title="Audit" variant="authed" subject={subject} otherOrgs={props.otherOrgs}>
      <header class="mb-6">
        <h1 class="text-xl font-semibold tracking-tight">Audit log</h1>
        <p class="text-sm text-gray-600">Recent events in {subject.org.displayName}.</p>
      </header>
      {events.length === 0 ? (
        <EmptyState title="No events yet." />
      ) : (
        <DataTable
          headers={['When', 'Actor', 'Action', 'Resource']}
          rows={events.map((e) => ({
            key: e.id,
            cells: [
              <RelativeTime value={e.createdAt} />,
              e.actorAccountId ?? '—',
              <code class="text-xs">{e.action}</code>,
              <code class="text-xs">{e.resourceKind}:{e.resourceId ?? '—'}</code>,
            ],
          }))}
        />
      )}
    </Layout>
  );
}
```

- [ ] **Step 4: Add route**

In `ui/app.tsx` add import:

```tsx
import { AuditPage } from './pages/audit.js';
```

Add route:

```tsx
  authed.get('/:orgSlug/audit', async (c) => {
    const repos = resolveDeps(c.get('tx'));
    const s = c.get('subject');
    if (s.org.slug !== c.req.param('orgSlug')) {
      return renderHtml(
        c,
        <ErrorPage status={403} title="Not authorized" backHref={`/${s.org.slug}`} />,
        403,
      );
    }
    const [auditRes, otherRes] = await Promise.all([
      repos.audit.list(s.org.id, { limit: 100 }),
      repos.organizations.listForAccount(s.account.id),
    ]);
    if (!isOk(auditRes)) {
      return renderHtml(c, <ErrorPage status={500} title="Error" detail={auditRes.error.message} />, 500);
    }
    const otherOrgs = isOk(otherRes) ? otherRes.value.filter((o) => o.slug !== s.org.slug) : [];
    return renderHtml(c, <AuditPage subject={s} otherOrgs={otherOrgs} events={auditRes.value} />);
  });
```

- [ ] **Step 5: Run test — verify it passes**

Run: `pnpm -F @rntme-cli/platform-http vitest run test/e2e/ui-browse.test.ts`
Expected: all passing.

- [ ] **Step 6: Run full suite**

Run: `pnpm -F @rntme-cli/platform-http test && pnpm -F @rntme-cli/platform-http typecheck && pnpm -F @rntme-cli/platform-http lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
cd rntme-cli
git add packages/platform-http/src/ui/pages/audit.tsx packages/platform-http/src/ui/app.tsx packages/platform-http/test/e2e/ui-browse.test.ts
git commit -m "feat(platform-http): add audit log page"
```

---

## End of Plan 03

**What was built:**
- `DataTable`, `EmptyState`, `RelativeTime` shared components.
- `OrgPage`, `ProjectPage`, `ServicePage`, `AuditPage`.
- Routes: `/:orgSlug`, `/:orgSlug/projects/:projSlug`, `/:orgSlug/projects/:projSlug/services/:svcSlug`, `/:orgSlug/audit`.
- Org mismatch produces 403 HTML; missing project/service produces 404 HTML.
- Dashboard is fully navigable read-only.

**What is still missing:** token management UI — list page exists as part of navigation but `/tokens` still 404s. Plan 04 adds the tokens page with htmx mutations.

**Verification before moving to Plan 04:**

```bash
cd rntme-cli && pnpm -F @rntme-cli/platform-http test && pnpm -F @rntme-cli/platform-http typecheck && pnpm -F @rntme-cli/platform-http lint
```

Expected: all green.
