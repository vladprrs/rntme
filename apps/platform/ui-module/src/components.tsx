import * as React from 'react';
import { useStateStore, useTransport } from '@rntme/contracts-client-runtime-v1';

type StatusVariant = 'ready' | 'building' | 'warn' | 'error' | 'queued' | 'canceled';

const STATUS_GLYPH: Record<StatusVariant, string> = {
  ready: '✓',
  building: '◐',
  warn: '!',
  error: '×',
  queued: '·',
  canceled: '–',
};

/* =========================================================
   Internal helpers
   ========================================================= */

function StatusBadge(props: { variant?: string; label?: string; size?: string }) {
  const variant = (props.variant ?? 'queued') as StatusVariant;
  const isLg = props.size === 'lg';
  const className = ['rntme-status', `is-${variant}`, isLg ? 'is-lg' : null].filter(Boolean).join(' ');
  return React.createElement(
    'span',
    { className },
    React.createElement('span', { className: 'rntme-status-glyph', 'aria-hidden': 'true' }, STATUS_GLYPH[variant]),
    props.label ?? variant.toUpperCase(),
  );
}

type ServiceInput = {
  name: string;
  status?: string;
  description?: string;
  entities?: number;
  schemas?: number;
  graphs?: number;
  endpoints?: number;
  uiComponents?: number;
  lastDeployedAt?: string;
};

function ServiceCard(props: ServiceInput) {
  const chips: Array<[string, number | undefined]> = [
    ['entities', props.entities],
    ['schemas', props.schemas],
    ['graphs', props.graphs],
    ['endpoints', props.endpoints],
    ['ui', props.uiComponents],
  ];
  const variant = (props.status?.toLowerCase() ?? 'queued') as StatusVariant;
  const badgeProps: { variant: StatusVariant; label?: string } = { variant };
  if (props.status !== undefined) badgeProps.label = props.status;
  return React.createElement(
    'article',
    { className: 'rntme-service-card' },
    React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { className: 'rntme-service-head' },
        React.createElement('span', { className: 'rntme-service-name' }, props.name),
        React.createElement(StatusBadge, badgeProps),
      ),
      props.description
        ? React.createElement('p', { className: 'rntme-service-desc' }, props.description)
        : null,
      React.createElement(
        'ul',
        { className: 'rntme-artifact-chips' },
        ...chips
          .filter(([, v]) => typeof v === 'number')
          .map(([k, v]) =>
            React.createElement(
              'li',
              { key: k, className: 'rntme-artifact-chip' },
              React.createElement('b', null, String(v)),
              ' ',
              k,
            ),
          ),
      ),
      props.lastDeployedAt
        ? React.createElement(
            'div',
            { className: 'rntme-service-meta' },
            'Last deployed · ',
            props.lastDeployedAt,
          )
        : null,
    ),
  );
}

type NavItem = {
  label: string;
  href?: string;
  count?: number | string;
  active?: boolean;
  section?: string;
};

type TimelineStep = {
  label: string;
  time?: string;
  meta?: string;
  state?: 'done' | 'current' | 'pending' | 'error';
};

/* =========================================================
   Exported platform components
   ========================================================= */

export function PlatformDataTable(props: { statePath?: string; columns?: ReadonlyArray<{ key: string; label: string }> }) {
  return React.createElement('div', { 'data-rntme-component': 'DataTable', 'data-state-path': props.statePath ?? '' });
}

export function PlatformTokenIssuer(props: {
  defaultName?: string;
  defaultScopesJson?: string;
  orgStatePath?: string;
}) {
  const transport = useTransport();
  const store = useStateStore();
  const orgStatePath = props.orgStatePath ?? '/route/params/orgId';
  const organizationId = store.get(orgStatePath);
  const [name, setName] = React.useState(props.defaultName ?? 'cv-extract-deploy');
  const [scopesJson, setScopesJson] = React.useState(
    props.defaultScopesJson
      ?? '["project:read","project:write","version:publish","deploy:execute","deploy:target:manage"]',
  );
  const [expiresAt, setExpiresAt] = React.useState('');
  const [plaintext, setPlaintext] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setPlaintext(null);
    setError(null);
    try {
      if (typeof organizationId !== 'string' || organizationId.length === 0) {
        setError('Organization route is missing.');
        return;
      }
      const parsedScopes = JSON.parse(scopesJson) as unknown;
      if (!Array.isArray(parsedScopes) || !parsedScopes.every((scope) => typeof scope === 'string')) {
        setError('Scopes must be a JSON array of strings.');
        return;
      }
      const body: Record<string, unknown> = {
        organizationId,
        name,
        scopesJson: JSON.stringify(parsedScopes),
      };
      if (expiresAt.trim().length > 0) body.expiresAt = expiresAt.trim();
      const url = new globalThis.URL('/api/tokens', window.location.href).toString();
      const response = await transport(new globalThis.Request(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }));
      if (!response.ok) {
        setError(`Token creation failed with HTTP ${response.status}.`);
        return;
      }
      const payload = (await response.json()) as { plaintext?: unknown };
      if (typeof payload.plaintext !== 'string' || !payload.plaintext.startsWith('rntme_pat_')) {
        setError('Token response did not include a PAT plaintext.');
        return;
      }
      setPlaintext(payload.plaintext);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return React.createElement(
    'section',
    { className: 'rntme-token-issuer' },
    React.createElement(
      'form',
      { className: 'rntme-token-form', onSubmit: submit },
      React.createElement(
        'label',
        null,
        React.createElement('span', null, 'Token name'),
        React.createElement('input', {
          value: name,
          onChange: (event: React.ChangeEvent) =>
            setName((event.currentTarget as unknown as { value: string }).value),
          required: true,
        }),
      ),
      React.createElement(
        'label',
        null,
        React.createElement('span', null, 'Scopes'),
        React.createElement('textarea', {
          value: scopesJson,
          onChange: (event: React.ChangeEvent) =>
            setScopesJson((event.currentTarget as unknown as { value: string }).value),
          rows: 3,
          required: true,
        }),
      ),
      React.createElement(
        'label',
        null,
        React.createElement('span', null, 'Expires at'),
        React.createElement('input', {
          value: expiresAt,
          onChange: (event: React.ChangeEvent) =>
            setExpiresAt((event.currentTarget as unknown as { value: string }).value),
          placeholder: 'Optional ISO timestamp',
        }),
      ),
      React.createElement(
        'button',
        { type: 'submit', className: 'rntme-btn is-primary', disabled: busy },
        busy ? 'Creating...' : 'Create token',
      ),
    ),
    error ? React.createElement('div', { className: 'rntme-token-error', role: 'alert' }, error) : null,
    plaintext
      ? React.createElement(
          'div',
          { className: 'rntme-token-result', role: 'status' },
          React.createElement('span', null, 'Save this token now. It will not be shown again.'),
          React.createElement('code', null, plaintext),
        )
      : null,
  );
}

export function PlatformPageHeader(props: {
  eyebrow?: string;
  title?: string;
  meta?: ReadonlyArray<{ label: string; value: string; status?: string }>;
  actions?: ReadonlyArray<{ label: string; variant?: string; onClick?: string; href?: string }>;
}) {
  const meta = props.meta ?? [];
  const actions = props.actions ?? [];
  return React.createElement(
    'header',
    { className: 'rntme-page-head' },
    React.createElement(
      'div',
      null,
      props.eyebrow
        ? React.createElement('div', { className: 'rntme-page-eyebrow' }, props.eyebrow)
        : null,
      props.title
        ? React.createElement('h1', { className: 'rntme-page-title' }, props.title)
        : null,
      meta.length
        ? React.createElement(
            'div',
            { className: 'rntme-page-meta', role: 'list' },
            ...meta.map((m, i) =>
              React.createElement(
                'div',
                { key: i, role: 'listitem' },
                React.createElement('span', null, m.label),
                m.status
                  ? React.createElement(
                      'b',
                      null,
                      React.createElement(StatusBadge, { variant: m.status, label: m.value, size: 'lg' }),
                    )
                  : React.createElement('b', null, m.value),
              ),
            ),
          )
        : null,
    ),
    actions.length
      ? React.createElement(
          'div',
          { className: 'rntme-page-head-actions' },
          ...actions.map((a, i) =>
            React.createElement(
              'button',
              {
                key: i,
                type: 'button',
                className: `rntme-btn is-small ${a.variant ? `is-${a.variant}` : 'is-secondary'}`,
              },
              a.label,
            ),
          ),
        )
      : null,
  );
}

export function PlatformSummaryGrid(props: { items?: ReadonlyArray<{ label: string; value: string | number; warn?: boolean }> }) {
  const items = props.items ?? [];
  const cols = Math.min(Math.max(items.length, 2), 7);
  return React.createElement(
    'div',
    {
      className: 'rntme-summary',
      role: 'group',
      'aria-label': 'Summary',
      style: { ['--rntme-summary-cols' as string]: String(cols) },
    },
    ...items.map((item, i) =>
      React.createElement(
        'div',
        { key: i, className: 'rntme-summary-cell' },
        React.createElement('span', { className: 'rntme-summary-label' }, item.label),
        React.createElement(
          'span',
          { className: `rntme-summary-value${item.warn ? ' is-warn' : ''}` },
          String(item.value),
        ),
      ),
    ),
  );
}

export function PlatformPanel(props: {
  title?: string;
  subtitle?: string;
  flush?: boolean;
  children?: React.ReactNode;
}) {
  return React.createElement(
    'section',
    { className: 'rntme-panel' },
    props.title || props.subtitle
      ? React.createElement(
          'header',
          { className: 'rntme-panel-head' },
          props.title
            ? React.createElement('span', { className: 'rntme-panel-title' }, props.title)
            : null,
          props.subtitle
            ? React.createElement('span', { className: 'rntme-panel-sub' }, props.subtitle)
            : null,
        )
      : null,
    React.createElement(
      'div',
      { className: `rntme-panel-body${props.flush ? ' is-flush' : ''}` },
      props.children,
    ),
  );
}

export function PlatformServicesPanel(props: {
  title?: string;
  subtitle?: string;
  statePath?: string;
  services?: ReadonlyArray<ServiceInput>;
}) {
  const services = props.services ?? [];
  return React.createElement(
    'section',
    { className: 'rntme-panel' },
    React.createElement(
      'header',
      { className: 'rntme-panel-head' },
      React.createElement('span', { className: 'rntme-panel-title' }, props.title ?? 'Services'),
      props.subtitle
        ? React.createElement('span', { className: 'rntme-panel-sub' }, props.subtitle)
        : null,
    ),
    React.createElement(
      'div',
      { className: 'rntme-services-cards' },
      ...services.map((s, i) => React.createElement(ServiceCard, { key: s.name ?? i, ...s })),
    ),
  );
}

export function PlatformTimeline(props: { steps?: ReadonlyArray<TimelineStep>; currentStep?: number; errored?: boolean }) {
  const steps = props.steps ?? [];
  const current = props.currentStep ?? steps.length;
  const errored = props.errored === true;
  return React.createElement(
    'ol',
    { className: 'rntme-timeline', style: { listStyle: 'none', margin: 0, padding: 0 } },
    ...steps.map((step, i) => {
      let state = step.state;
      if (!state) {
        if (errored && i === current) state = 'error';
        else if (i < current) state = 'done';
        else if (i === current) state = 'current';
        else state = 'pending';
      }
      return React.createElement(
        'li',
        { key: i, className: `rntme-timeline-step is-${state}` },
        React.createElement(
          'span',
          { className: 'rntme-timeline-glyph', 'aria-hidden': 'true' },
          state === 'done' ? '✓' : state === 'error' ? '×' : String(i + 1),
        ),
        React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'rntme-timeline-label' }, step.label),
          step.meta
            ? React.createElement('span', { className: 'rntme-timeline-meta' }, step.meta)
            : null,
        ),
        step.time
          ? React.createElement('span', { className: 'rntme-timeline-time' }, step.time)
          : null,
      );
    }),
  );
}

export function PlatformAlertList(props: {
  variant?: string;
  items?: ReadonlyArray<{ title?: string; service?: string; message?: string; artifact?: string; jsonPath?: string }>;
}) {
  const variant = (props.variant ?? 'warn') as 'error' | 'warn';
  const items = props.items ?? [];
  return React.createElement(
    'ul',
    { className: 'rntme-alerts-list' },
    ...items.map((item, i) =>
      React.createElement(
        'li',
        { key: i, className: `rntme-alert is-${variant}` },
        React.createElement(
          'span',
          { className: 'rntme-alert-glyph', 'aria-hidden': 'true' },
          variant === 'error' ? '×' : '!',
        ),
        React.createElement(
          'div',
          { className: 'rntme-alert-body' },
          React.createElement(
            'div',
            { className: 'rntme-alert-head' },
            item.title
              ? React.createElement('span', { className: 'rntme-alert-title' }, item.title)
              : null,
            item.service
              ? React.createElement('span', { className: 'rntme-alert-svc' }, item.service)
              : null,
          ),
          item.message
            ? React.createElement('p', { className: 'rntme-alert-msg' }, item.message)
            : null,
          item.artifact || item.jsonPath
            ? React.createElement(
                'span',
                { className: 'rntme-alert-path' },
                item.artifact
                  ? React.createElement(React.Fragment, null, React.createElement('b', null, 'Artifact: '), item.artifact)
                  : null,
                item.artifact && item.jsonPath ? ' · ' : null,
                item.jsonPath
                  ? React.createElement(React.Fragment, null, React.createElement('b', null, 'Path: '), item.jsonPath)
                  : null,
              )
            : null,
        ),
      ),
    ),
  );
}

export function PlatformBanner(props: {
  variant?: string;
  title?: string;
  message?: string;
  artifact?: string;
  jsonPath?: string;
  suggestedAction?: string;
}) {
  const variant = (props.variant ?? 'warn') as 'error' | 'warn';
  return React.createElement(
    'div',
    { className: `rntme-banner is-${variant}`, role: variant === 'error' ? 'alert' : 'status' },
    React.createElement(
      'div',
      { className: 'rntme-banner-glyph', 'aria-hidden': 'true' },
      variant === 'error' ? '×' : '!',
    ),
    React.createElement(
      'div',
      null,
      props.title
        ? React.createElement(
            'h2',
            { className: 'rntme-banner-title' },
            props.title,
          )
        : null,
      props.message
        ? React.createElement('p', { className: 'rntme-banner-msg' }, props.message)
        : null,
      props.artifact || props.jsonPath
        ? React.createElement(
            'span',
            { className: 'rntme-banner-path' },
            props.artifact
              ? React.createElement(React.Fragment, null, React.createElement('b', null, 'Artifact: '), props.artifact)
              : null,
            props.artifact && props.jsonPath ? ' · ' : null,
            props.jsonPath
              ? React.createElement(React.Fragment, null, React.createElement('b', null, 'Path: '), props.jsonPath)
              : null,
          )
        : null,
      props.suggestedAction
        ? React.createElement(
            'p',
            { className: 'rntme-banner-msg', style: { marginTop: 10 } },
            React.createElement('b', null, 'Suggested action: '),
            props.suggestedAction,
          )
        : null,
    ),
  );
}

export function PlatformEmptyState(props: {
  eyebrow?: string;
  title?: string;
  body?: string;
  command?: string;
  docsLabel?: string;
  docsHref?: string;
}) {
  return React.createElement(
    'section',
    { className: 'rntme-empty' },
    React.createElement(
      'div',
      { className: 'rntme-empty-inner' },
      props.eyebrow
        ? React.createElement('div', { className: 'rntme-empty-eyebrow' }, props.eyebrow)
        : null,
      props.title
        ? React.createElement('h1', { className: 'rntme-empty-title' }, props.title)
        : null,
      props.body
        ? React.createElement('p', { className: 'rntme-empty-body' }, props.body)
        : null,
      props.command
        ? React.createElement(
            'div',
            { className: 'rntme-cmd' },
            React.createElement('span', { className: 'rntme-cmd-text' }, props.command),
          )
        : null,
      props.docsHref
        ? React.createElement(
            'a',
            { className: 'rntme-btn is-ghost is-small', href: props.docsHref },
            props.docsLabel ?? 'Read docs',
          )
        : null,
    ),
  );
}

export function PlatformSidebar(props: {
  brand?: string;
  version?: string;
  contextLabel?: string;
  contextName?: string;
  contextMeta?: string;
  items?: ReadonlyArray<NavItem>;
  cliVersion?: string;
}) {
  const items = props.items ?? [];
  // Group by section, preserving order of first occurrence.
  const sections: Array<{ name: string; items: NavItem[] }> = [];
  for (const item of items) {
    const section = item.section ?? 'Navigation';
    let bucket = sections.find((s) => s.name === section);
    if (!bucket) {
      bucket = { name: section, items: [] };
      sections.push(bucket);
    }
    bucket.items.push(item);
  }
  return React.createElement(
    'aside',
    { className: 'rntme-sidebar' },
    React.createElement(
      'div',
      { className: 'rntme-sidebar-brand' },
      React.createElement('span', { className: 'rntme-sidebar-brand-mark', 'aria-hidden': 'true' }, 'rn'),
      React.createElement('span', { className: 'rntme-sidebar-brand-wordmark' }, props.brand ?? 'rntme'),
      props.version
        ? React.createElement('span', { className: 'rntme-sidebar-brand-meta' }, props.version)
        : null,
    ),
    props.contextName
      ? React.createElement(
          'div',
          { className: 'rntme-sidebar-context' },
          props.contextLabel
            ? React.createElement('span', { className: 'rntme-sidebar-context-label' }, props.contextLabel)
            : null,
          React.createElement('span', { className: 'rntme-sidebar-context-name' }, props.contextName),
          props.contextMeta
            ? React.createElement('span', { className: 'rntme-sidebar-context-meta' }, props.contextMeta)
            : null,
        )
      : null,
    React.createElement(
      'nav',
      { className: 'rntme-sidebar-nav', 'aria-label': 'Primary' },
      ...sections.flatMap((section, si) => [
        React.createElement('div', { key: `s-${si}`, className: 'rntme-sidebar-nav-section' }, section.name),
        React.createElement(
          'ul',
          { key: `l-${si}`, className: 'rntme-sidebar-nav-list' },
          ...section.items.map((item, ii) =>
            React.createElement(
              'li',
              { key: ii, className: 'rntme-sidebar-nav-item' },
              React.createElement(
                'a',
                {
                  href: item.href ?? '#',
                  className: item.active ? 'is-active' : '',
                  'aria-current': item.active ? 'page' : undefined,
                },
                item.label,
                item.count !== undefined
                  ? React.createElement('span', { className: 'rntme-sidebar-nav-count' }, String(item.count))
                  : null,
              ),
            ),
          ),
        ),
      ]),
    ),
    React.createElement(
      'div',
      { className: 'rntme-sidebar-foot' },
      React.createElement(
        'span',
        null,
        'CLI',
        React.createElement('span', { className: 'rntme-sidebar-foot-dot', 'aria-hidden': 'true' }),
        props.cliVersion ?? '—',
      ),
      React.createElement('span', null, 'Docs'),
    ),
  );
}

export function PlatformTopbar(props: {
  crumbs?: ReadonlyArray<{ label: string; current?: boolean }>;
  actions?: ReadonlyArray<{ label: string; variant?: string; href?: string }>;
}) {
  const crumbs = props.crumbs ?? [];
  const actions = props.actions ?? [];
  return React.createElement(
    'header',
    { className: 'rntme-topbar' },
    React.createElement(
      'nav',
      { className: 'rntme-topbar-crumbs', 'aria-label': 'Breadcrumb' },
      ...crumbs.flatMap((c, i) => [
        i > 0 ? React.createElement('span', { key: `sep-${i}`, className: 'sep' }, '/') : null,
        c.current
          ? React.createElement('b', { key: `c-${i}` }, c.label)
          : React.createElement('span', { key: `c-${i}` }, c.label),
      ]),
    ),
    React.createElement('div', { className: 'rntme-topbar-spacer' }),
    actions.length
      ? React.createElement(
          'div',
          { className: 'rntme-topbar-actions' },
          ...actions.map((a, i) =>
            React.createElement(
              'a',
              {
                key: i,
                href: a.href ?? '#',
                className: `rntme-btn is-small ${a.variant ? `is-${a.variant}` : 'is-ghost'}`,
              },
              a.label,
            ),
          ),
        )
      : null,
  );
}

export function PlatformPage(props: { children?: React.ReactNode }) {
  return React.createElement('section', { className: 'rntme-page' }, props.children);
}

export function PlatformBox(props: { className?: string; as?: string; children?: React.ReactNode }) {
  const tag = props.as ?? 'div';
  return React.createElement(tag, { className: props.className }, props.children);
}
