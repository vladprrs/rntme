import { defineCatalog } from '@json-render/core';
import { schema, defineRegistry } from '@json-render/react';
import { shadcnComponentDefinitions } from '@json-render/shadcn/catalog';
import { shadcnComponents } from '@json-render/shadcn';
import * as React from 'react';
import { z } from 'zod';
import type { CompiledScreen, CompiledAction, CompiledDataEndpoint, PropSchema } from '@rntme/ui';
import type { StateStore } from '@json-render/core';
import type { BaseComponentProps } from '@json-render/react';
import type { OperationRegistry } from '@rntme/contracts-client-runtime-v1';

export type RuntimeBridge = {
  onNavigate: (path: string) => void;
  getScreen: () => CompiledScreen | null;
  store: StateStore;
  fetchEndpoint: (statePath: string, endpoint: CompiledDataEndpoint) => Promise<void>;
  fetchFn: typeof fetch;
  operationRegistry?: OperationRegistry;
};

function DataTable(props: { statePath?: string; columns?: ReadonlyArray<{ key: string; label: string }> }) {
  return React.createElement('div', { 'data-rntme-component': 'DataTable', 'data-state-path': props.statePath ?? '' });
}

/* =========================================================
   Editorial dashboard components
   These produce DOM that pairs with the .rntme-* CSS rules
   declared in client/styles.css.
   ========================================================= */

type StatusVariant = 'ready' | 'building' | 'warn' | 'error' | 'queued' | 'canceled';

const STATUS_GLYPH: Record<StatusVariant, string> = {
  ready: '✓',
  building: '◐',
  warn: '!',
  error: '×',
  queued: '·',
  canceled: '–',
};

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

function PageHeader(props: {
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

function SummaryGrid(props: { items?: ReadonlyArray<{ label: string; value: string | number; warn?: boolean }> }) {
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

function Panel(props: {
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

function ServicesPanel(props: {
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

type TimelineStep = {
  label: string;
  time?: string;
  meta?: string;
  state?: 'done' | 'current' | 'pending' | 'error';
};

function Timeline(props: { steps?: ReadonlyArray<TimelineStep>; currentStep?: number; errored?: boolean }) {
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

function AlertList(props: {
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

function Banner(props: {
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

function EmptyState(props: {
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

type NavItem = {
  label: string;
  href?: string;
  count?: number | string;
  active?: boolean;
  section?: string;
};

function Sidebar(props: {
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

function Topbar(props: {
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

function DashGrid(props: { children?: React.ReactNode }) {
  return React.createElement('div', { className: 'rntme-dash-grid' }, props.children);
}

function PageContainer(props: { children?: React.ReactNode }) {
  return React.createElement('section', { className: 'rntme-page' }, props.children);
}

function Box(props: { className?: string; as?: string; children?: React.ReactNode }) {
  const tag = props.as ?? 'div';
  return React.createElement(tag, { className: props.className }, props.children);
}

/* ----- Zod schemas for the new core components -------------- */
const statusSchema = z.enum(['ready', 'building', 'warn', 'error', 'queued', 'canceled']);

const coreDefs = {
  DataTable: {
    props: z.object({
      statePath: z.string().optional(),
      columns: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
    }),
  },
  StatusBadge: {
    props: z.object({
      variant: statusSchema.optional(),
      label: z.string().optional(),
      size: z.enum(['sm', 'lg']).optional(),
    }),
  },
  PageHeader: {
    props: z.object({
      eyebrow: z.string().optional(),
      title: z.string().optional(),
      meta: z
        .array(z.object({ label: z.string(), value: z.string(), status: statusSchema.optional() }))
        .optional(),
      actions: z
        .array(z.object({ label: z.string(), variant: z.string().optional(), href: z.string().optional() }))
        .optional(),
    }),
  },
  SummaryGrid: {
    props: z.object({
      items: z
        .array(
          z.object({
            label: z.string(),
            value: z.union([z.string(), z.number()]),
            warn: z.boolean().optional(),
          }),
        )
        .optional(),
    }),
  },
  Panel: {
    props: z.object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      flush: z.boolean().optional(),
    }),
  },
  ServicesPanel: {
    props: z.object({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      statePath: z.string().optional(),
      services: z
        .array(
          z.object({
            name: z.string(),
            status: z.string().optional(),
            description: z.string().optional(),
            entities: z.number().optional(),
            schemas: z.number().optional(),
            graphs: z.number().optional(),
            endpoints: z.number().optional(),
            uiComponents: z.number().optional(),
            lastDeployedAt: z.string().optional(),
          }),
        )
        .optional(),
    }),
  },
  Timeline: {
    props: z.object({
      steps: z
        .array(
          z.object({
            label: z.string(),
            time: z.string().optional(),
            meta: z.string().optional(),
            state: z.enum(['done', 'current', 'pending', 'error']).optional(),
          }),
        )
        .optional(),
      currentStep: z.number().optional(),
      errored: z.boolean().optional(),
    }),
  },
  AlertList: {
    props: z.object({
      variant: z.enum(['error', 'warn']).optional(),
      items: z
        .array(
          z.object({
            title: z.string().optional(),
            service: z.string().optional(),
            message: z.string().optional(),
            artifact: z.string().optional(),
            jsonPath: z.string().optional(),
          }),
        )
        .optional(),
    }),
  },
  Banner: {
    props: z.object({
      variant: z.enum(['error', 'warn']).optional(),
      title: z.string().optional(),
      message: z.string().optional(),
      artifact: z.string().optional(),
      jsonPath: z.string().optional(),
      suggestedAction: z.string().optional(),
    }),
  },
  EmptyState: {
    props: z.object({
      eyebrow: z.string().optional(),
      title: z.string().optional(),
      body: z.string().optional(),
      command: z.string().optional(),
      docsLabel: z.string().optional(),
      docsHref: z.string().optional(),
    }),
  },
  Sidebar: {
    props: z.object({
      brand: z.string().optional(),
      version: z.string().optional(),
      contextLabel: z.string().optional(),
      contextName: z.string().optional(),
      contextMeta: z.string().optional(),
      cliVersion: z.string().optional(),
      items: z
        .array(
          z.object({
            label: z.string(),
            href: z.string().optional(),
            count: z.union([z.string(), z.number()]).optional(),
            active: z.boolean().optional(),
            section: z.string().optional(),
          }),
        )
        .optional(),
    }),
  },
  Topbar: {
    props: z.object({
      crumbs: z
        .array(z.object({ label: z.string(), current: z.boolean().optional() }))
        .optional(),
      actions: z
        .array(z.object({ label: z.string(), variant: z.string().optional(), href: z.string().optional() }))
        .optional(),
    }),
  },
  DashGrid: { props: z.object({}) },
  PageContainer: { props: z.object({}) },
  Box: {
    props: z.object({
      className: z.string().optional(),
      as: z.string().optional(),
    }),
  },
} as const;

const coreReact = {
  DataTable,
  StatusBadge,
  PageHeader,
  SummaryGrid,
  Panel,
  ServicesPanel,
  Timeline,
  AlertList,
  Banner,
  EmptyState,
  Sidebar,
  Topbar,
  DashGrid,
  PageContainer,
  Box,
} as const;

function wrapRuntimeComponent(
  Component: React.ComponentType<Record<string, unknown>>,
): (ctx: BaseComponentProps<Record<string, unknown>>) => React.ReactNode {
  return ({ props, children }) => React.createElement(Component, { ...props, children });
}

function wrapRuntimeComponents(
  components: Record<string, React.ComponentType<Record<string, unknown>>>,
): Record<string, (ctx: BaseComponentProps<Record<string, unknown>>) => React.ReactNode> {
  const wrapped: Record<string, (ctx: BaseComponentProps<Record<string, unknown>>) => React.ReactNode> = {};
  for (const [type, Component] of Object.entries(components)) {
    wrapped[type] = wrapRuntimeComponent(Component);
  }
  return wrapped;
}

function propsRecordToZod(props: Record<string, PropSchema>): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [k, sch] of Object.entries(props)) {
    let inner: z.ZodTypeAny;
    switch (sch.type) {
      case 'string':
        inner = z.string();
        break;
      case 'number':
        inner = z.number();
        break;
      case 'boolean':
        inner = z.boolean();
        break;
      case 'object':
        inner = z.record(z.string(), z.unknown());
        break;
      case 'array':
        inner = z.array(z.unknown());
        break;
      default:
        inner = z.unknown();
    }
    if (sch.array === true) inner = z.array(inner);
    shape[k] = sch.required === true ? inner : inner.optional();
  }
  return z.object(shape);
}

export type ModuleSurfaceForRegistry = {
  readonly components: ReadonlyArray<{ type: string; props: Record<string, PropSchema> }>;
  readonly reactByType: Record<string, React.ComponentType<Record<string, unknown>>>;
};

const sharedActions = {
  navigate: {
    params: z.object({ to: z.string() }).passthrough(),
    description:
      'Client-side navigation. :param placeholders in `to` are replaced from remaining params.',
  },
  dispatch: {
    params: z.object({ name: z.string() }),
    description: 'Execute a screen-defined action by name (command, refetch).',
  },
} as const;

export function createRegistry(bridge: RuntimeBridge, surface?: ModuleSurfaceForRegistry | undefined) {
  function resolveActionParams(params: Record<string, unknown> | undefined): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!params) return out;
    for (const [k, v] of Object.entries(params)) {
      if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
        out[k] = bridge.store.get((v as { $state: string }).$state);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  const extraDefs: Record<string, { props: z.ZodObject<Record<string, z.ZodTypeAny>> }> = {};
  const extraReact: Record<string, (ctx: BaseComponentProps<Record<string, unknown>>) => React.ReactNode> = {};
  if (surface) {
    for (const c of surface.components) {
      extraDefs[c.type] = { props: propsRecordToZod(c.props) };
      const R = surface.reactByType[c.type];
      if (R) extraReact[c.type] = wrapRuntimeComponent(R);
    }
  }

  const catalog = defineCatalog(schema, {
    components: { ...shadcnComponentDefinitions, ...(coreDefs as unknown as typeof shadcnComponentDefinitions), ...(extraDefs as typeof shadcnComponentDefinitions) },
    actions: { ...sharedActions },
  });

  const { registry, handlers } = defineRegistry(catalog, {
    components: {
      ...shadcnComponents,
      ...wrapRuntimeComponents(coreReact as unknown as Record<string, React.ComponentType<Record<string, unknown>>>),
      ...extraReact,
    },
    actions: {
      navigate: async (params) => {
        if (!params) return;
        let target = params.to;
        for (const [k, v] of Object.entries(params)) {
          if (k !== 'to') target = target.replace(`:${k}`, String(v));
        }
        bridge.onNavigate(target);
      },
      dispatch: async (params) => {
        if (!params) return;
        const screen = bridge.getScreen();
        if (!screen?.actions) return;
        const actionName = params.name;
        const action = screen.actions[actionName] as CompiledAction | undefined;
        if (!action) return;

        if (action.kind === 'navigation') {
          let target = action.navigateTo;
          if (action.paramsFromState) {
            for (const [param, statePath] of Object.entries(action.paramsFromState)) {
              target = target.replace(`:${param}`, String(bridge.store.get(statePath) ?? ''));
            }
          }
          bridge.onNavigate(target);
          return;
        }

        if (action.kind === 'refetch') {
          const currentScreen = bridge.getScreen();
          if (!currentScreen?.data) return;
          for (const refetchTarget of action.targets) {
            const endpoint = currentScreen.data[refetchTarget];
            if (endpoint) await bridge.fetchEndpoint(refetchTarget, endpoint);
          }
          return;
        }

        if (action.kind === 'module-action') {
          const p = resolveActionParams(action.params as Record<string, unknown> | undefined);
          if (action.target) {
            await bridge.operationRegistry?.lookupComponent(action.target, action.name)?.(p);
          } else if (action.module) {
            await bridge.operationRegistry?.lookupModule(action.module, action.name)?.(p);
          }
          return;
        }

        if (action.kind !== 'command') return;

        const cmdParams: Record<string, unknown> = {};
        if (action.paramsFromState) {
          for (const [param, statePath] of Object.entries(action.paramsFromState)) {
            cmdParams[param] = bridge.store.get(statePath);
          }
        }

        let url = action.path;
        url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
          const v = cmdParams[key];
          delete cmdParams[key];
          return String(v ?? '');
        });

        try {
          const res = await bridge.fetchFn(url, {
            method: action.method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(cmdParams),
          });
          if (!res.ok) {
            if (action.onError?.showAlert) {
              const text = await res.text().catch(() => `HTTP ${res.status}`);
              globalThis.alert?.(text) ?? console.error(text);
            }
            return;
          }
          if (action.onSuccess?.refetchData) {
            const currentScreen = bridge.getScreen();
            if (currentScreen?.data) {
              for (const dataPath of action.onSuccess.refetchData) {
                const endpoint = currentScreen.data[dataPath];
                if (endpoint) await bridge.fetchEndpoint(dataPath, endpoint);
              }
            }
          }
          if (action.onSuccess?.navigateTo) {
            bridge.onNavigate(action.onSuccess.navigateTo);
          }
        } catch (e) {
          if (action.onError?.showAlert) {
            const msg = e instanceof Error ? e.message : String(e);
            globalThis.alert?.(msg) ?? console.error(msg);
          }
        }
      },
    },
  });

  return { catalog, registry, handlers };
}
