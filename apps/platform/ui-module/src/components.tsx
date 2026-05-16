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

/**
 * Normalises a fetched data-endpoint body to an array of rows.
 *
 * The UI runtime stores the raw response body at a screen's `statePath`. Live
 * platform list endpoints are not consistent: some return a bare array
 * (`/api/projects/{id}/versions`), others wrap the rows in a status envelope
 * (`/api/projects` -> `{ status, projects }`, `/api/deployments` ->
 * `{ status, deployments }`, `/api/deployments/targets` -> `{ status, targets }`,
 * `/api/deployments/stages` -> `{ status, deploymentId, stages }`,
 * `/api/tokens` -> `{ tokens }`, `/api/audit` -> `{ events }`). This unwraps the
 * common shapes so `statePath`-driven components render regardless.
 */
function rowsFromState(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  if (value !== null && typeof value === 'object') {
    const envelope = value as Record<string, unknown>;
    for (const key of [
      'projects',
      'deployments',
      'targets',
      'deployTargets',
      'tokens',
      'events',
      'versions',
      'logs',
      'stages',
      'endpoints',
      'items',
      'rows',
    ]) {
      const candidate = envelope[key];
      if (Array.isArray(candidate)) return candidate as Array<Record<string, unknown>>;
    }
  }
  return [];
}

/** Coerces a fetched state row into the `ServiceInput` shape the panel renders. */
function toServiceInput(row: Record<string, unknown>): ServiceInput {
  const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);
  return {
    name: str(row.name) ?? '',
    status: str(row.status),
    description: str(row.description),
    entities: num(row.entities),
    schemas: num(row.schemas),
    graphs: num(row.graphs),
    endpoints: num(row.endpoints),
    uiComponents: num(row.uiComponents),
    lastDeployedAt: str(row.lastDeployedAt),
  };
}

/** Renders a single data-table cell value as text. */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

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
  hrefTemplate?: string;
  matchPattern?: string;
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

type LinkTemplateContext = {
  row?: Record<string, unknown>;
  routeParams?: Record<string, unknown>;
};

function objectFromState(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveTemplate(template: string, context: LinkTemplateContext): string {
  return template.replace(/\{([A-Za-z0-9_]+)\}/g, (_match, key: string) => {
    const raw = context.row?.[key] ?? context.routeParams?.[key];
    if (raw === null || raw === undefined) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
      return encodeURIComponent(String(raw));
    }
    return '';
  });
}

function actionHref(
  action: { href?: string; hrefTemplate?: string },
  routeParams: Record<string, unknown>,
): string | undefined {
  if (action.hrefTemplate) return resolveTemplate(action.hrefTemplate, { routeParams });
  return action.href;
}

/* =========================================================
   Exported platform components
   ========================================================= */

type DataTableColumn = {
  key: string;
  label: string;
  value?: string;
  href?: string;
  hrefTemplate?: string;
  /**
   * Per-row link dispatch. When set, the rendered link template is chosen by
   * looking up `row[typeField]` in `byType`; rows whose type has no entry (or
   * resolves to an empty string) render as plain text. Lets a single column
   * carry multiple link targets (e.g. audit-row targets that fan out to
   * deployment / project / target detail screens) without per-row
   * runtime-level routing.
   */
  hrefTemplateMap?: {
    typeField: string;
    byType: Record<string, string>;
  };
};

function resolveColumnHref(
  column: DataTableColumn,
  row: Record<string, unknown>,
  routeParams: Record<string, unknown>,
): string | undefined {
  if (column.hrefTemplateMap) {
    const { typeField, byType } = column.hrefTemplateMap;
    const rawType = row[typeField];
    if (typeof rawType !== 'string' || rawType.length === 0) return undefined;
    const template = byType[rawType];
    if (typeof template !== 'string' || template.length === 0) return undefined;
    const resolved = resolveTemplate(template, { row, routeParams });
    return resolved.length > 0 ? resolved : undefined;
  }
  if (column.hrefTemplate) {
    return resolveTemplate(column.hrefTemplate, { row, routeParams });
  }
  return column.href;
}

export function PlatformDataTable(props: {
  statePath?: string;
  columns?: ReadonlyArray<DataTableColumn>;
}) {
  const store = useStateStore();
  const columns = props.columns ?? [];
  const rows = props.statePath ? rowsFromState(store.get(props.statePath)) : [];
  const routeParams = objectFromState(store.get('/route/params'));

  return React.createElement(
    'div',
    { 'data-rntme-component': 'DataTable', 'data-state-path': props.statePath ?? '' },
    React.createElement(
      'table',
      { className: 'rntme-data-table' },
      React.createElement(
        'thead',
        null,
        React.createElement(
          'tr',
          null,
          ...columns.map((column) =>
            React.createElement('th', { key: column.key }, column.label),
          ),
        ),
      ),
      React.createElement(
        'tbody',
        null,
        rows.length === 0
          ? React.createElement(
              'tr',
              { className: 'rntme-data-table-empty' },
              React.createElement(
                'td',
                { colSpan: columns.length > 0 ? columns.length : 1 },
                'No records',
              ),
            )
            : rows.map((row, rowIndex) =>
              React.createElement(
                'tr',
                { key: typeof row.id === 'string' ? row.id : rowIndex },
                ...columns.map((column) => {
                  const href = resolveColumnHref(column, row, routeParams);
                  const label = column.value ?? formatCellValue(row[column.key]);
                  const cell = href
                    ? React.createElement('a', { href }, label)
                    : label;
                  return React.createElement('td', { key: column.key }, cell);
                }),
              ),
            ),
      ),
    ),
  );
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

type PageHeaderMetaItem = { label: string; value: string; status?: string };

/**
 * Derives the live `Blueprint`/`Status` header meta cells from a fetched
 * project-version list.
 *
 * `projects.listProjectVersions` returns `ProjectVersionView` rows
 * (`{ projectId, sequence, status, ... }`). The latest version is the row with
 * the highest `sequence`; its `sequence` becomes `Blueprint vN` and its
 * `status` becomes the `Status` cell (mapped to a `ready` badge when
 * `published`). When no version row is present yet, both fall back to `—` so
 * the header stays populated before the first fetch resolves.
 */
function versionMetaFromState(value: unknown): PageHeaderMetaItem[] {
  const rows = rowsFromState(value);
  let latest: Record<string, unknown> | undefined;
  for (const row of rows) {
    const seq = typeof row.sequence === 'number' ? row.sequence : -1;
    const bestSeq = latest && typeof latest.sequence === 'number' ? latest.sequence : -1;
    if (!latest || seq > bestSeq) latest = row;
  }
  const sequence = latest && typeof latest.sequence === 'number' ? latest.sequence : undefined;
  const status = latest && typeof latest.status === 'string' ? latest.status : undefined;
  const statusItem: PageHeaderMetaItem =
    status === 'published'
      ? { label: 'Status', value: 'Ready', status: 'ready' }
      : status === 'rejected'
        ? { label: 'Status', value: 'Rejected', status: 'error' }
        : { label: 'Status', value: status ?? '—' };
  return [
    { label: 'Blueprint', value: sequence !== undefined ? `v${sequence}` : '—' },
    statusItem,
  ];
}

export function PlatformPageHeader(props: {
  eyebrow?: string;
  title?: string;
  meta?: ReadonlyArray<PageHeaderMetaItem>;
  statePath?: string;
  actions?: ReadonlyArray<{ label: string; variant?: string; onClick?: string; href?: string; hrefTemplate?: string }>;
}) {
  const store = useStateStore();
  // When a `statePath` is wired, the `Blueprint`/`Status` cells are derived from
  // the project-version list and merged ahead of any remaining literal `meta`
  // entries (e.g. `Environment`, `Published by`). Without a `statePath`, the
  // header falls back to the literal `meta` prop unchanged.
  const meta: ReadonlyArray<PageHeaderMetaItem> = props.statePath
    ? [...versionMetaFromState(store.get(props.statePath)), ...(props.meta ?? [])]
    : props.meta ?? [];
  const actions = props.actions ?? [];
  const routeParams = objectFromState(store.get('/route/params'));
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
          ...actions.map((a, i) => {
            const className = `rntme-btn is-small ${a.variant ? `is-${a.variant}` : 'is-secondary'}`;
            const href = actionHref(a, routeParams);
            if (href) {
              return React.createElement('a', { key: i, href, className }, a.label);
            }
            return React.createElement(
              'button',
              {
                key: i,
                type: 'button',
                className,
              },
              a.label,
            );
          }),
        )
      : null,
  );
}

/** Ordered (key, label) pairs for the artifact-summary counts a `statePath` carries. */
const SUMMARY_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ['versions', 'Versions'],
  ['services', 'Services'],
  ['entities', 'Entities'],
  ['schemas', 'Schemas'],
  ['graphs', 'Graphs'],
  ['endpoints', 'Endpoints'],
  ['uiComponents', 'UI components'],
];

/**
 * Unwraps a fetched artifact-summary body into labelled summary cells.
 *
 * The summary endpoint returns a single object (not a list), either bare or
 * wrapped in a `{ status, summary }` envelope. Missing fields render as `0`
 * so the grid stays populated even before the first fetch resolves.
 */
function summaryItemsFromState(value: unknown): Array<{ label: string; value: string | number }> {
  let record: Record<string, unknown> = {};
  if (value !== null && typeof value === 'object') {
    const envelope = value as Record<string, unknown>;
    const inner = envelope.summary;
    record = inner !== null && typeof inner === 'object'
      ? (inner as Record<string, unknown>)
      : envelope;
  }
  return SUMMARY_FIELDS.map(([key, label]) => {
    const raw = record[key];
    return { label, value: typeof raw === 'number' ? raw : 0 };
  });
}

export function PlatformSummaryGrid(props: {
  items?: ReadonlyArray<{ label: string; value: string | number; warn?: boolean }>;
  statePath?: string;
}) {
  const store = useStateStore();
  // When a `statePath` is wired, the grid is state-driven (counts parsed from
  // the artifact-summary endpoint); otherwise it falls back to literal `items`.
  const items: ReadonlyArray<{ label: string; value: string | number; warn?: boolean }> =
    props.statePath ? summaryItemsFromState(store.get(props.statePath)) : props.items ?? [];
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

type DataModelEndpoint = {
  service?: string;
  operation?: string;
  method?: string;
  path?: string;
  graph?: string;
};

type DataModelField = {
  name?: string;
  type?: string;
  nullable?: boolean;
  column?: string;
  generated?: string;
  primaryKey?: boolean;
  stateField?: boolean;
  qsmProjections?: readonly string[];
  description?: string;
  default?: unknown;
  validation?: readonly string[];
};

type DataModelRelation = {
  name?: string;
  target?: string;
  cardinality?: string;
  localKey?: string;
  foreignKey?: string;
  missingTarget?: boolean;
};

type DataModelEntity = {
  name?: string;
  ownerService?: string;
  kind?: string;
  table?: string;
  path?: string;
  keys?: readonly string[];
  fields?: readonly DataModelField[];
  relations?: readonly DataModelRelation[];
  stateMachine?: { stateField?: string; states?: readonly string[]; transitions?: readonly string[] };
  qsmProjections?: readonly string[];
  endpoints?: readonly DataModelEndpoint[];
  raw?: unknown;
};

type DataModelProjection = {
  name?: string;
  service?: string;
  path?: string;
  backing?: string;
  sourceEntity?: string;
  keys?: readonly string[];
  grain?: readonly string[];
  exposed?: readonly string[];
  fields?: ReadonlyArray<{ name?: string; type?: string; nullable?: boolean; source?: string; computed?: boolean }>;
  endpoints?: readonly DataModelEndpoint[];
  raw?: unknown;
};

type DataModelState = {
  summary?: {
    entities?: number;
    fields?: number;
    relationships?: number;
    qsmProjections?: number;
    warnings?: number;
    errors?: number;
  };
  entities?: readonly DataModelEntity[];
  qsmProjections?: readonly DataModelProjection[];
  relationships?: readonly {
    source?: string;
    name?: string;
    target?: string;
    cardinality?: string;
    missingTarget?: boolean;
  }[];
  findings?: readonly DataModelFinding[];
};

type DataModelFinding = {
  kind?: 'warning' | 'error' | string;
  entity?: string;
  projection?: string;
  service?: string;
  artifact?: string;
  jsonPath?: string;
  message?: string;
  suggestedAction?: string;
};

type EntityStatus = 'Valid' | 'Warning' | 'Error';
type EntitySubtab = 'fields' | 'relationships' | 'usedby' | 'raw';
type ProjectionSubtab = 'fields' | 'endpoints' | 'raw';
type SelectedField = { entityName: string; fieldName: string };

function dataModelFromState(value: unknown): DataModelState {
  if (!isObjectRecord(value)) return {};
  const envelope = value as Record<string, unknown>;
  const candidate = isObjectRecord(envelope.dataModel) ? envelope.dataModel : envelope;
  return candidate as DataModelState;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function dataModelSummaryItems(model: DataModelState): Array<{ label: string; value: string | number; warn?: boolean }> {
  const summary = model.summary ?? {};
  return [
    { label: 'Entities', value: summary.entities ?? 0 },
    { label: 'Fields', value: summary.fields ?? 0 },
    { label: 'Relationships', value: summary.relationships ?? 0 },
    { label: 'QSM projections', value: summary.qsmProjections ?? 0 },
    { label: 'Warnings', value: summary.warnings ?? 0, warn: (summary.warnings ?? 0) > 0 },
    { label: 'Errors', value: summary.errors ?? 0, warn: (summary.errors ?? 0) > 0 },
  ];
}

function endpointLabel(endpoint: DataModelEndpoint): string {
  const method = endpoint.method ?? '';
  const path = endpoint.path ?? '';
  return `${method} ${path}`.trim() || endpoint.operation || 'Endpoint';
}

function uniqueSorted(values: readonly (string | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)),
  ).sort((a, b) => a.localeCompare(b));
}

function includesQuery(parts: readonly (string | undefined)[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return parts.some((part) => String(part ?? '').toLowerCase().includes(normalized));
}

function entityStatus(entity: DataModelEntity, findings: readonly DataModelFinding[]): EntityStatus {
  const entityName = entity.name ?? '';
  const entityFindings = findings.filter((finding) => finding.entity === entityName);
  if (
    entityFindings.some((finding) => finding.kind === 'error') ||
    (entity.relations ?? []).some((relation) => relation.missingTarget)
  ) {
    return 'Error';
  }
  if (entityFindings.some((finding) => finding.kind === 'warning')) return 'Warning';
  return 'Valid';
}

function statusClass(status: EntityStatus): string {
  if (status === 'Error') return 'is-error';
  if (status === 'Warning') return 'is-warning';
  return 'is-valid';
}

function findingKindClass(finding: DataModelFinding): string {
  return finding.kind === 'error' ? 'is-error' : 'is-warning';
}

function entityFieldPath(entity: DataModelEntity, field: DataModelField): string {
  return `${entity.path ?? entity.name ?? 'entity'}#/fields/${field.name ?? 'field'}`;
}

function rawPreview(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
}

export function PlatformDataModelExplorer(props: { statePath?: string }) {
  const store = useStateStore();
  const model = props.statePath ? dataModelFromState(store.get(props.statePath)) : {};
  const entities = model.entities ?? [];
  const projections = model.qsmProjections ?? [];
  const relationships = model.relationships ?? [];
  const findings = model.findings ?? [];
  const [tab, setTab] = React.useState<'pdm' | 'qsm'>('pdm');
  const [selectedEntityName, setSelectedEntityName] = React.useState(entities[0]?.name ?? '');
  const [selectedProjectionName, setSelectedProjectionName] = React.useState(projections[0]?.name ?? '');
  const [entityQuery, setEntityQuery] = React.useState('');
  const [entityServiceFilter, setEntityServiceFilter] = React.useState('all');
  const [entityStatusFilter, setEntityStatusFilter] = React.useState('all');
  const [projectionQuery, setProjectionQuery] = React.useState('');
  const [projectionServiceFilter, setProjectionServiceFilter] = React.useState('all');
  const [entitySubtab, setEntitySubtab] = React.useState<EntitySubtab>('fields');
  const [projectionSubtab, setProjectionSubtab] = React.useState<ProjectionSubtab>('fields');
  const [selectedField, setSelectedField] = React.useState<SelectedField | null>(null);
  const [toast, setToast] = React.useState('');

  const selectedEntity =
    entities.find((entity) => entity.name === selectedEntityName) ?? entities[0];
  const selectedProjection =
    projections.find((projection) => projection.name === selectedProjectionName) ?? projections[0];
  const hasModel = entities.length > 0 || projections.length > 0;
  const showToast = (message: string) => setToast(message);
  const selectEntity = (name: string) => {
    setTab('pdm');
    setSelectedEntityName(name);
    setEntitySubtab('fields');
    setSelectedField(null);
  };
  const selectProjection = (name: string) => {
    setTab('qsm');
    setSelectedProjectionName(name);
    setProjectionSubtab('fields');
  };

  if (!hasModel) {
    return React.createElement(PlatformEmptyState, {
      eyebrow: 'Data model',
      title: 'No data model published',
      body: 'Publish a blueprint with pdm/entities/*.json and services/*/qsm/projections/*.json artifacts to inspect the model here.',
      command: 'rntme project publish',
      docsLabel: 'Read PDM docs',
      docsHref: '/docs',
    });
  }

  return React.createElement(
    'section',
    { className: 'rntme-data-model-explorer', 'data-state-path': props.statePath ?? '' },
    React.createElement(PlatformSummaryGrid, { items: dataModelSummaryItems(model) }),
    renderFindings(findings, selectEntity, selectProjection),
    React.createElement(
      'div',
      { className: 'rntme-dm-tabs', role: 'tablist', 'aria-label': 'Data model views' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: tab === 'pdm' ? 'is-active' : '',
          'aria-selected': tab === 'pdm',
          onClick: () => setTab('pdm'),
        },
        'PDM entities',
        React.createElement('span', null, String(entities.length)),
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          className: tab === 'qsm' ? 'is-active' : '',
          'aria-selected': tab === 'qsm',
          onClick: () => setTab('qsm'),
        },
        'QSM projections',
        React.createElement('span', null, String(projections.length)),
      ),
    ),
    tab === 'pdm'
      ? renderEntityExplorer({
          entities,
          selectedEntity,
          relationships,
          findings,
          query: entityQuery,
          serviceFilter: entityServiceFilter,
          statusFilter: entityStatusFilter,
          subtab: entitySubtab,
          setQuery: setEntityQuery,
          setServiceFilter: setEntityServiceFilter,
          setStatusFilter: setEntityStatusFilter,
          setSubtab: setEntitySubtab,
          selectEntity,
          setSelectedField,
          showToast,
        })
      : renderProjectionExplorer({
          projections,
          selectedProjection,
          query: projectionQuery,
          serviceFilter: projectionServiceFilter,
          subtab: projectionSubtab,
          setQuery: setProjectionQuery,
          setServiceFilter: setProjectionServiceFilter,
          setSubtab: setProjectionSubtab,
          selectProjection,
          selectEntity,
        }),
    renderFieldSheet(entities, selectedField, () => setSelectedField(null), showToast),
    toast.length > 0 ? React.createElement('div', { className: 'rntme-dm-toast', role: 'status' }, toast) : null,
  );
}

function renderFindings(
  findings: readonly DataModelFinding[],
  selectEntity: (name: string) => void,
  selectProjection: (name: string) => void,
) {
  if (findings.length === 0) return null;
  return React.createElement(
    'section',
    { className: 'rntme-dm-findings', 'aria-label': 'Data-model findings' },
    React.createElement('div', { className: 'rntme-dm-section-label' }, 'Data-model findings'),
    ...findings.map((finding, index) =>
      React.createElement(
        'button',
        {
          key: `${finding.artifact ?? 'finding'}-${index}`,
          type: 'button',
          className: findingKindClass(finding),
          onClick: () => {
            if (finding.entity) selectEntity(finding.entity);
            else if (finding.projection) selectProjection(finding.projection);
          },
        },
        React.createElement('span', null, finding.kind === 'error' ? 'Error' : 'Warning'),
        React.createElement('b', null, finding.message ?? 'Data model finding'),
        React.createElement('code', null, finding.jsonPath ?? finding.artifact ?? ''),
      ),
    ),
  );
}

type EntityExplorerProps = {
  entities: readonly DataModelEntity[];
  selectedEntity: DataModelEntity | undefined;
  relationships: NonNullable<DataModelState['relationships']>;
  findings: readonly DataModelFinding[];
  query: string;
  serviceFilter: string;
  statusFilter: string;
  subtab: EntitySubtab;
  setQuery: (value: string) => void;
  setServiceFilter: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setSubtab: (value: EntitySubtab) => void;
  selectEntity: (name: string) => void;
  setSelectedField: (value: SelectedField | null) => void;
  showToast: (message: string) => void;
};

function renderEntityExplorer(props: EntityExplorerProps) {
  const services = uniqueSorted(props.entities.map((entity) => entity.ownerService));
  const filtered = props.entities.filter((entity) => {
    const status = entityStatus(entity, props.findings);
    return (
      includesQuery([entity.name, entity.ownerService, entity.table], props.query) &&
      (props.serviceFilter === 'all' || entity.ownerService === props.serviceFilter) &&
      (props.statusFilter === 'all' || status === props.statusFilter)
    );
  });
  const groups = services
    .map((service) => ({
      service,
      entities: filtered.filter((entity) => entity.ownerService === service),
    }))
    .filter((group) => group.entities.length > 0);

  return React.createElement(
    'div',
    { className: 'rntme-dm-grid' },
    React.createElement(
      'aside',
      { className: 'rntme-dm-list', 'aria-label': 'PDM entities' },
      renderTreeControls({
        query: props.query,
        onQuery: props.setQuery,
        searchLabel: 'Search PDM entities',
        serviceFilter: props.serviceFilter,
        onServiceFilter: props.setServiceFilter,
        services,
        serviceLabel: 'Filter PDM entities by service',
      }),
      React.createElement(
        'select',
        {
          className: 'rntme-dm-filter',
          'aria-label': 'Filter PDM entities by status',
          value: props.statusFilter,
          onChange: (event: React.ChangeEvent<{ value: string }>) => props.setStatusFilter(event.currentTarget.value),
        },
        React.createElement('option', { value: 'all' }, 'All statuses'),
        React.createElement('option', { value: 'Valid' }, 'Valid'),
        React.createElement('option', { value: 'Warning' }, 'Warning'),
        React.createElement('option', { value: 'Error' }, 'Error'),
      ),
      groups.length === 0
        ? React.createElement('p', { className: 'rntme-dm-empty-row' }, 'No entities match.')
        : groups.map((group) =>
            React.createElement(
              'section',
              { key: group.service, className: 'rntme-dm-tree-group' },
              React.createElement(
                'div',
                { className: 'rntme-dm-tree-head' },
                React.createElement('span', null, group.service),
                React.createElement('b', null, String(group.entities.length)),
              ),
              ...group.entities.map((entity) => {
                const status = entityStatus(entity, props.findings);
                return React.createElement(
                  'button',
                  {
                    key: entity.name ?? '',
                    type: 'button',
                    className: entity.name === props.selectedEntity?.name ? 'is-active' : '',
                    'data-dm-entity': entity.name ?? '',
                    onClick: () => props.selectEntity(entity.name ?? ''),
                  },
                  React.createElement('span', { className: `rntme-dm-pip ${statusClass(status)}`, 'aria-hidden': 'true' }),
                  React.createElement('span', { className: 'rntme-dm-item-title' }, entity.name ?? 'Entity'),
                  React.createElement(
                    'span',
                    { className: 'rntme-dm-item-meta' },
                    entity.fields?.length ?? 0,
                    ' fields · ',
                    status,
                  ),
                );
              }),
            ),
          ),
    ),
    React.createElement(
      'div',
      { className: 'rntme-dm-detail' },
      props.selectedEntity
        ? renderEntityDetail({
            entity: props.selectedEntity,
            entities: props.entities,
            subtab: props.subtab,
            setSubtab: props.setSubtab,
            selectEntity: props.selectEntity,
            setSelectedField: props.setSelectedField,
            showToast: props.showToast,
          })
        : null,
      renderRelationshipDiagram(props.entities, props.relationships, props.selectedEntity?.name, props.selectEntity, props.showToast),
    ),
  );
}

function renderTreeControls(props: {
  query: string;
  onQuery: (value: string) => void;
  searchLabel: string;
  serviceFilter: string;
  onServiceFilter: (value: string) => void;
  services: readonly string[];
  serviceLabel: string;
}) {
  return React.createElement(
    'div',
    { className: 'rntme-dm-tree-controls' },
    React.createElement('input', {
      type: 'search',
      value: props.query,
      placeholder: props.searchLabel,
      'aria-label': props.searchLabel,
      onChange: (event: React.ChangeEvent<{ value: string }>) => props.onQuery(event.currentTarget.value),
      onInput: (event: React.FormEvent<{ value: string }>) => props.onQuery(event.currentTarget.value),
    }),
    React.createElement(
      'select',
      {
        className: 'rntme-dm-filter',
        'aria-label': props.serviceLabel,
        value: props.serviceFilter,
        onChange: (event: React.ChangeEvent<{ value: string }>) => props.onServiceFilter(event.currentTarget.value),
      },
      React.createElement('option', { value: 'all' }, 'All services'),
      ...props.services.map((service) => React.createElement('option', { key: service, value: service }, service)),
    ),
  );
}

function renderEntityDetail(props: {
  entity: DataModelEntity;
  entities: readonly DataModelEntity[];
  subtab: EntitySubtab;
  setSubtab: (value: EntitySubtab) => void;
  selectEntity: (name: string) => void;
  setSelectedField: (value: SelectedField | null) => void;
  showToast: (message: string) => void;
}) {
  const entity = props.entity;
  const endpoints = entity.endpoints ?? [];
  const projections = entity.qsmProjections ?? [];
  return React.createElement(
    'article',
    { className: 'rntme-dm-card' },
    React.createElement(
      'header',
      { className: 'rntme-dm-detail-head' },
      React.createElement(
        'div',
        null,
        React.createElement('span', { className: 'rntme-dm-eyebrow' }, 'PDM entity'),
        React.createElement('h2', null, entity.name ?? 'Entity'),
        React.createElement(
          'p',
          null,
          entity.ownerService ?? 'project',
          ' · ',
          entity.kind ?? 'owned',
          ' · table ',
          entity.table ?? '—',
        ),
      ),
      React.createElement('code', null, entity.path ?? ''),
    ),
    React.createElement(
      'div',
      { className: 'rntme-dm-meta-grid' },
      React.createElement('span', null, 'Keys', React.createElement('b', null, (entity.keys ?? []).join(', ') || '—')),
      React.createElement('span', null, 'State field', React.createElement('b', null, entity.stateMachine?.stateField ?? '—')),
      React.createElement('span', null, 'QSM projections', React.createElement('b', null, projections.join(', ') || '—')),
    ),
    renderEntitySubtabs(props.subtab, props.setSubtab, entity, endpoints, projections),
    renderEntitySubtabContent(props),
  );
}

function renderEntitySubtabs(
  subtab: EntitySubtab,
  setSubtab: (value: EntitySubtab) => void,
  entity: DataModelEntity,
  endpoints: readonly DataModelEndpoint[],
  projections: readonly string[],
) {
  const tabs: Array<{ id: EntitySubtab; label: string; count?: number }> = [
    { id: 'fields', label: 'Fields', count: entity.fields?.length ?? 0 },
    { id: 'relationships', label: 'Relationships', count: entity.relations?.length ?? 0 },
    { id: 'usedby', label: 'Used by', count: endpoints.length + projections.length },
    { id: 'raw', label: 'Raw artifact' },
  ];
  return React.createElement(
    'div',
    { className: 'rntme-dm-subtabs', role: 'tablist', 'aria-label': 'Entity detail sections' },
    ...tabs.map((tab) =>
      React.createElement(
        'button',
        {
          key: tab.id,
          type: 'button',
          className: subtab === tab.id ? 'is-active' : '',
          'data-dm-subtab': tab.id,
          onClick: () => setSubtab(tab.id),
        },
        tab.label,
        tab.count === undefined ? null : React.createElement('span', null, String(tab.count)),
      ),
    ),
  );
}

function renderEntitySubtabContent(props: {
  entity: DataModelEntity;
  entities: readonly DataModelEntity[];
  subtab: EntitySubtab;
  selectEntity: (name: string) => void;
  setSelectedField: (value: SelectedField | null) => void;
  showToast: (message: string) => void;
}) {
  if (props.subtab === 'relationships') {
    return renderEntityRelationships(props.entity, props.entities, props.selectEntity, props.showToast);
  }
  if (props.subtab === 'usedby') {
    return renderEntityUsages(props.entity);
  }
  if (props.subtab === 'raw') {
    return renderRawArtifact(props.entity.path, props.entity.raw, props.showToast);
  }
  return renderEntityFields(props.entity, props.setSelectedField);
}

function renderEntityFields(entity: DataModelEntity, setSelectedField: (value: SelectedField | null) => void) {
  return React.createElement(
    'table',
    { className: 'rntme-dm-table' },
    React.createElement(
      'thead',
      null,
      React.createElement(
        'tr',
        null,
        React.createElement('th', null, 'Field'),
        React.createElement('th', null, 'Type'),
        React.createElement('th', null, 'Column'),
        React.createElement('th', null, 'Flags'),
        React.createElement('th', null, 'Used by'),
      ),
    ),
    React.createElement(
      'tbody',
      null,
      ...(entity.fields ?? []).map((field) =>
        React.createElement(
          'tr',
          {
            key: field.name ?? '',
            role: 'button',
            tabIndex: 0,
            'data-dm-field': field.name ?? '',
            onClick: () => setSelectedField({ entityName: entity.name ?? '', fieldName: field.name ?? '' }),
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedField({ entityName: entity.name ?? '', fieldName: field.name ?? '' });
              }
            },
          },
          React.createElement('td', null, field.name ?? ''),
          React.createElement('td', null, field.type ?? ''),
          React.createElement('td', null, field.column ?? ''),
          React.createElement(
            'td',
            null,
            [
              field.nullable === false ? 'required' : 'nullable',
              field.primaryKey ? 'key' : '',
              field.stateField ? 'state' : '',
              field.generated ?? '',
            ].filter(Boolean).join(' · '),
          ),
          React.createElement('td', null, (field.qsmProjections ?? []).join(', ') || '—'),
        ),
      ),
    ),
  );
}

function renderEntityRelationships(
  entity: DataModelEntity,
  entities: readonly DataModelEntity[],
  selectEntity: (name: string) => void,
  showToast: (message: string) => void,
) {
  const entityNames = new Set(entities.map((item) => item.name).filter((name): name is string => typeof name === 'string'));
  return React.createElement(
    'section',
    { className: 'rntme-dm-relations' },
    (entity.relations ?? []).length === 0
      ? React.createElement('p', null, 'No relationships declared.')
      : React.createElement(
          'ul',
          null,
          ...(entity.relations ?? []).map((relation) =>
            React.createElement(
              'li',
              { key: relation.name ?? relation.target ?? '' },
              React.createElement('span', null, entity.name ?? ''),
              React.createElement('b', null, relation.name ?? ''),
              React.createElement(
                'button',
                {
                  type: 'button',
                  'data-dm-relation-target': relation.target ?? '',
                  onClick: () => {
                    if (relation.target && entityNames.has(relation.target)) selectEntity(relation.target);
                    else showToast(`Missing entity ${relation.target ?? ''}`.trim());
                  },
                },
                relation.target ?? '',
              ),
              React.createElement('code', null, relation.cardinality ?? ''),
              relation.missingTarget ? React.createElement('strong', null, 'missing target') : null,
            ),
          ),
        ),
  );
}

function renderEntityUsages(entity: DataModelEntity) {
  return React.createElement(
    'div',
    { className: 'rntme-dm-usage-grid' },
    renderUsageGroup('QSM projections', entity.qsmProjections ?? []),
    renderUsageGroup('API endpoints', (entity.endpoints ?? []).map(endpointLabel)),
  );
}

function renderUsageGroup(label: string, values: readonly string[]) {
  return React.createElement(
    'div',
    { className: 'rntme-dm-usage' },
    React.createElement('span', null, label),
    values.length
      ? values.map((value) => React.createElement('code', { key: value }, value))
      : React.createElement('em', null, `No ${label.toLowerCase()} found.`),
  );
}

function renderRawArtifact(path: string | undefined, raw: unknown, showToast: (message: string) => void) {
  return React.createElement(
    'div',
    { className: 'rntme-dm-raw' },
    React.createElement(
      'button',
      {
        type: 'button',
        className: 'rntme-dm-copy',
        onClick: () => copyText(path ?? '', 'artifact path', showToast),
      },
      'Copy artifact path',
    ),
    React.createElement('pre', { className: 'rntme-dm-json' }, rawPreview(raw)),
  );
}

function renderRelationshipDiagram(
  entities: readonly DataModelEntity[],
  relationships: NonNullable<DataModelState['relationships']>,
  selectedName: string | undefined,
  selectEntity: (name: string) => void,
  showToast: (message: string) => void,
) {
  const entityNames = new Set(entities.map((entity) => entity.name).filter((name): name is string => typeof name === 'string'));
  const nodeNames = uniqueSorted([
    ...entities.map((entity) => entity.name),
    ...relationships.flatMap((relationship) => [relationship.source, relationship.target]),
  ]);
  const columnCount = Math.max(1, Math.ceil(Math.sqrt(nodeNames.length)));
  const width = Math.max(420, columnCount * 180);
  const rowCount = Math.max(1, Math.ceil(nodeNames.length / columnCount));
  const height = Math.max(180, rowCount * 110);
  const nodeByName = new Map(
    nodeNames.map((name, index) => [
      name,
      {
        name,
        x: 60 + (index % columnCount) * 170,
        y: 40 + Math.floor(index / columnCount) * 100,
      },
    ]),
  );
  const relatedNames = new Set<string>();
  for (const relationship of relationships) {
    if (relationship.source === selectedName && relationship.target) relatedNames.add(relationship.target);
    if (relationship.target === selectedName && relationship.source) relatedNames.add(relationship.source);
  }

  return React.createElement(
    'section',
    { className: 'rntme-dm-card rntme-dm-diagram', 'aria-label': 'Relationship diagram' },
    React.createElement('h2', null, 'Relationship diagram'),
    relationships.length === 0
      ? React.createElement('p', null, 'No relationships declared.')
      : React.createElement(
          'div',
          { className: 'rntme-dm-diagram-frame', style: { minHeight: `${height}px` } },
          React.createElement(
            'svg',
            { viewBox: `0 0 ${width} ${height}`, className: 'rntme-dm-diagram-canvas', role: 'img' },
            ...relationships.map((relationship, index) => {
              const source = relationship.source ? nodeByName.get(relationship.source) : undefined;
              const target = relationship.target ? nodeByName.get(relationship.target) : undefined;
              if (!source || !target) return null;
              return React.createElement('line', {
                key: `${relationship.source ?? ''}-${relationship.target ?? ''}-${index}`,
                x1: source.x + 56,
                y1: source.y + 20,
                x2: target.x + 56,
                y2: target.y + 20,
                className: relationship.missingTarget ? 'is-missing' : '',
              });
            }),
          ),
          ...nodeNames.map((name) => {
            const node = nodeByName.get(name);
            const isMissing = !entityNames.has(name);
            const className = [
              'rntme-dm-diagram-node',
              selectedName === name ? 'is-selected' : '',
              relatedNames.has(name) ? 'is-related' : '',
              isMissing ? 'is-missing' : '',
            ].filter(Boolean).join(' ');
            return React.createElement(
              'button',
              {
                key: name,
                type: 'button',
                className,
                style: { left: `${node?.x ?? 0}px`, top: `${node?.y ?? 0}px` },
                onClick: () => {
                  if (entityNames.has(name)) selectEntity(name);
                  else showToast(`Missing entity ${name}`);
                },
              },
              name,
              isMissing ? React.createElement('span', null, 'missing target') : null,
            );
          }),
        ),
  );
}

type ProjectionExplorerProps = {
  projections: readonly DataModelProjection[];
  selectedProjection: DataModelProjection | undefined;
  query: string;
  serviceFilter: string;
  subtab: ProjectionSubtab;
  setQuery: (value: string) => void;
  setServiceFilter: (value: string) => void;
  setSubtab: (value: ProjectionSubtab) => void;
  selectProjection: (name: string) => void;
  selectEntity: (name: string) => void;
};

function renderProjectionExplorer(props: ProjectionExplorerProps) {
  const services = uniqueSorted(props.projections.map((projection) => projection.service));
  const filtered = props.projections.filter(
    (projection) =>
      includesQuery([projection.name, projection.service, projection.sourceEntity], props.query) &&
      (props.serviceFilter === 'all' || projection.service === props.serviceFilter),
  );
  const groups = services
    .map((service) => ({
      service,
      projections: filtered.filter((projection) => projection.service === service),
    }))
    .filter((group) => group.projections.length > 0);

  return React.createElement(
    'div',
    { className: 'rntme-dm-grid' },
    React.createElement(
      'aside',
      { className: 'rntme-dm-list', 'aria-label': 'QSM projections' },
      renderTreeControls({
        query: props.query,
        onQuery: props.setQuery,
        searchLabel: 'Search QSM projections',
        serviceFilter: props.serviceFilter,
        onServiceFilter: props.setServiceFilter,
        services,
        serviceLabel: 'Filter QSM projections by service',
      }),
      groups.length === 0
        ? React.createElement('p', { className: 'rntme-dm-empty-row' }, 'No projections match.')
        : groups.map((group) =>
            React.createElement(
              'section',
              { key: group.service, className: 'rntme-dm-tree-group' },
              React.createElement(
                'div',
                { className: 'rntme-dm-tree-head' },
                React.createElement('span', null, group.service),
                React.createElement('b', null, String(group.projections.length)),
              ),
              ...group.projections.map((projection) =>
                React.createElement(
                  'button',
                  {
                    key: projection.name ?? '',
                    type: 'button',
                    className: projection.name === props.selectedProjection?.name ? 'is-active' : '',
                    onClick: () => props.selectProjection(projection.name ?? ''),
                  },
                  React.createElement('span', { className: 'rntme-dm-item-title' }, projection.name ?? 'Projection'),
                  React.createElement(
                    'span',
                    { className: 'rntme-dm-item-meta' },
                    projection.sourceEntity ?? 'entity',
                    ' · ',
                    projection.fields?.length ?? 0,
                    ' fields',
                  ),
                ),
              ),
            ),
          ),
    ),
    props.selectedProjection ? renderProjectionDetail(props.selectedProjection, props.subtab, props.setSubtab, props.selectEntity) : null,
  );
}

function renderProjectionDetail(
  projection: DataModelProjection,
  subtab: ProjectionSubtab,
  setSubtab: (value: ProjectionSubtab) => void,
  selectEntity: (name: string) => void,
) {
  const endpoints = projection.endpoints ?? [];
  return React.createElement(
    'article',
    { className: 'rntme-dm-detail rntme-dm-card' },
    React.createElement(
      'header',
      { className: 'rntme-dm-detail-head' },
      React.createElement(
        'div',
        null,
        React.createElement('span', { className: 'rntme-dm-eyebrow' }, 'QSM projection'),
        React.createElement('h2', null, projection.name ?? 'Projection'),
        React.createElement(
          'p',
          null,
          projection.service ?? 'service',
          ' · ',
          projection.backing ?? 'entity-mirror',
          ' · source ',
          projection.sourceEntity ?? '—',
        ),
      ),
      React.createElement('code', null, projection.path ?? ''),
    ),
    React.createElement(
      'div',
      { className: 'rntme-dm-usage' },
      React.createElement('span', null, 'Source entity'),
      projection.sourceEntity
        ? React.createElement(
            'button',
            { type: 'button', className: 'rntme-dm-chip-button', onClick: () => selectEntity(projection.sourceEntity ?? '') },
            projection.sourceEntity,
          )
        : React.createElement('em', null, 'No source entity declared.'),
    ),
    renderProjectionSubtabs(subtab, setSubtab, projection),
    subtab === 'endpoints'
      ? renderUsageGroup('API endpoints', endpoints.map(endpointLabel))
      : subtab === 'raw'
        ? renderRawArtifact(projection.path, projection.raw, () => undefined)
        : renderProjectionFields(projection),
  );
}

function renderProjectionSubtabs(
  subtab: ProjectionSubtab,
  setSubtab: (value: ProjectionSubtab) => void,
  projection: DataModelProjection,
) {
  const tabs: Array<{ id: ProjectionSubtab; label: string; count?: number }> = [
    { id: 'fields', label: 'Fields', count: projection.fields?.length ?? 0 },
    { id: 'endpoints', label: 'API endpoints', count: projection.endpoints?.length ?? 0 },
    { id: 'raw', label: 'Raw artifact' },
  ];
  return React.createElement(
    'div',
    { className: 'rntme-dm-subtabs', role: 'tablist', 'aria-label': 'Projection detail sections' },
    ...tabs.map((tab) =>
      React.createElement(
        'button',
        {
          key: tab.id,
          type: 'button',
          className: subtab === tab.id ? 'is-active' : '',
          onClick: () => setSubtab(tab.id),
        },
        tab.label,
        tab.count === undefined ? null : React.createElement('span', null, String(tab.count)),
      ),
    ),
  );
}

function renderProjectionFields(projection: DataModelProjection) {
  return React.createElement(
    'table',
    { className: 'rntme-dm-table' },
    React.createElement(
      'thead',
      null,
      React.createElement(
        'tr',
        null,
        React.createElement('th', null, 'Field'),
        React.createElement('th', null, 'Type'),
        React.createElement('th', null, 'Source'),
        React.createElement('th', null, 'Mode'),
      ),
    ),
    React.createElement(
      'tbody',
      null,
      ...(projection.fields ?? []).map((field) =>
        React.createElement(
          'tr',
          { key: field.name ?? '' },
          React.createElement('td', null, field.name ?? ''),
          React.createElement('td', null, field.type ?? ''),
          React.createElement('td', null, React.createElement('code', null, field.source ?? '')),
          React.createElement('td', null, field.computed ? 'computed' : 'mirrored'),
        ),
      ),
    ),
  );
}

function renderFieldSheet(
  entities: readonly DataModelEntity[],
  selectedField: SelectedField | null,
  close: () => void,
  showToast: (message: string) => void,
) {
  if (!selectedField) return null;
  const entity = entities.find((item) => item.name === selectedField.entityName);
  const field = entity?.fields?.find((item) => item.name === selectedField.fieldName);
  if (!entity || !field) return null;
  const path = entityFieldPath(entity, field);
  return React.createElement(
    'div',
    { className: 'rntme-dm-sheet-wrap' },
    React.createElement('button', { type: 'button', className: 'rntme-dm-sheet-scrim', 'aria-label': 'Close field detail', onClick: close }),
    React.createElement(
      'aside',
      { className: 'rntme-dm-sheet', role: 'dialog', 'aria-label': 'Field detail' },
      React.createElement(
        'header',
        null,
        React.createElement('span', { className: 'rntme-dm-section-label' }, 'Field detail'),
        React.createElement('h2', null, field.name ?? 'Field'),
        React.createElement('button', { type: 'button', onClick: close, 'aria-label': 'Close field detail' }, 'Close'),
      ),
      React.createElement(
        'dl',
        null,
        React.createElement('dt', null, 'Entity'),
        React.createElement('dd', null, entity.name ?? ''),
        React.createElement('dt', null, 'Type'),
        React.createElement('dd', null, field.type ?? ''),
        React.createElement('dt', null, 'Column'),
        React.createElement('dd', null, field.column ?? ''),
        React.createElement('dt', null, 'Default'),
        React.createElement('dd', null, field.default === undefined || field.default === null ? '—' : String(field.default)),
        React.createElement('dt', null, 'Used in'),
        React.createElement('dd', null, (field.qsmProjections ?? []).join(', ') || '—'),
        React.createElement('dt', null, 'JSON path'),
        React.createElement('dd', null, React.createElement('code', null, path)),
      ),
      React.createElement(
        'div',
        { className: 'rntme-dm-sheet-actions' },
        React.createElement(
          'button',
          {
            type: 'button',
            'data-dm-copy-field-path': true,
            onClick: () => copyText(path, 'field path', showToast),
          },
          'Copy field path',
        ),
        React.createElement(
          'button',
          { type: 'button', onClick: () => copyText(rawPreview(field), 'field JSON', showToast) },
          'Copy field JSON',
        ),
      ),
    ),
  );
}

function copyText(text: string, label: string, showToast: (message: string) => void) {
  if (text.length > 0 && globalThis.navigator?.clipboard?.writeText) {
    void globalThis.navigator.clipboard.writeText(text);
  }
  showToast(`Copied ${label}`);
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
  const store = useStateStore();
  // When a `statePath` is wired, the panel is state-driven (even if empty);
  // otherwise it falls back to the literal `services` prop.
  const services: ReadonlyArray<ServiceInput> = props.statePath
    ? rowsFromState(store.get(props.statePath)).map(toServiceInput)
    : props.services ?? [];
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

/**
 * The five dashboard timeline steps and the runtime BPMN stages that feed each.
 *
 * `deployments.listDeployStages` returns raw `deploy_stage_state` rows whose
 * `stage` is a runtime BPMN id (`compose` | `provision` | `plan` | `render` |
 * `apply` | `verify`). The dashboard collapses those six stages onto the five
 * UX steps from the project-dashboard mock:
 *
 * - `Queued`     — synthetic; "done" as soon as any stage row exists.
 * - `Validating` — `compose` (blueprint composed + validated).
 * - `Building`   — `provision` + `plan` + `render` (deployment plan built).
 * - `Deploying`  — `apply` (plan applied to the target).
 * - `Ready`      — `verify` (deployment verified and serving).
 *
 * A step is `error` if any backing stage `failed`, `done` if all present
 * backing stages `succeeded`, `current` if any backing stage is `running`, and
 * `pending` when no backing stage row exists yet.
 */
const TIMELINE_STEPS: ReadonlyArray<{ label: string; stages: readonly string[] }> = [
  { label: 'Queued', stages: [] },
  { label: 'Validating', stages: ['compose'] },
  { label: 'Building', stages: ['provision', 'plan', 'render'] },
  { label: 'Deploying', stages: ['apply'] },
  { label: 'Ready', stages: ['verify'] },
];

type DeployStageRowState = {
  stage: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
};

/** Coerces a fetched state row into the `DeployStageRowState` shape. */
function toDeployStageRow(row: Record<string, unknown>): DeployStageRowState {
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  return {
    stage: str(row.stage) ?? '',
    status: str(row.status) ?? '',
    errorCode: str(row.errorCode),
    errorMessage: str(row.errorMessage),
    startedAt: str(row.startedAt),
    finishedAt: str(row.finishedAt),
  };
}

/** Formats an ISO timestamp as a `HH:MM:SS` clock label, mirroring the mock. */
function clockTime(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(11, 19);
}

/**
 * Folds `deployments.listDeployStages` rows into the five ordered timeline
 * steps. Returns the steps plus whether any stage failed, so the caller can
 * flag the timeline as errored.
 */
function timelineFromState(value: unknown): { steps: TimelineStep[]; errored: boolean } {
  const rows = rowsFromState(value).map(toDeployStageRow);
  const byStage = new Map<string, DeployStageRowState>();
  for (const row of rows) {
    if (row.stage.length > 0) byStage.set(row.stage, row);
  }
  let errored = false;
  const steps = TIMELINE_STEPS.map((definition, index) => {
    const backing =
      index === 0
        ? rows
        : definition.stages.map((s) => byStage.get(s)).filter((r): r is DeployStageRowState => r !== undefined);
    let state: TimelineStep['state'] = 'pending';
    if (index === 0) {
      state = rows.length > 0 ? 'done' : 'pending';
    } else if (backing.length === 0) {
      state = 'pending';
    } else if (backing.some((r) => r.status === 'failed')) {
      state = 'error';
      errored = true;
    } else if (backing.some((r) => r.status === 'running')) {
      state = 'current';
    } else if (backing.every((r) => r.status === 'succeeded') && backing.length === definition.stages.length) {
      state = 'done';
    } else {
      state = 'current';
    }
    const failed = backing.find((r) => r.status === 'failed');
    const times = backing
      .map((r) => clockTime(r.finishedAt) ?? clockTime(r.startedAt))
      .filter((t): t is string => t !== undefined);
    const step: TimelineStep = { label: definition.label, state };
    if (times.length > 0) step.time = times[times.length - 1]!;
    if (failed?.errorMessage) {
      step.meta = failed.errorMessage;
    } else if (failed?.errorCode) {
      step.meta = failed.errorCode;
    }
    return step;
  });
  return { steps, errored };
}

export function PlatformTimeline(props: {
  steps?: ReadonlyArray<TimelineStep>;
  currentStep?: number;
  errored?: boolean;
  statePath?: string;
}) {
  const store = useStateStore();
  // When a `statePath` is wired, the timeline is state-driven: stage rows from
  // `deployments.listDeployStages` are folded onto the five Queued -> Validating
  // -> Building -> Deploying -> Ready steps, each carrying its own `state` so
  // the `currentStep` index is not needed. Without a `statePath`, the component
  // falls back to the literal `steps` prop unchanged.
  const derived = props.statePath ? timelineFromState(store.get(props.statePath)) : null;
  const steps = derived ? derived.steps : props.steps ?? [];
  const current = props.currentStep ?? steps.length;
  const errored = derived ? derived.errored : props.errored === true;
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
  const store = useStateStore();
  const items = props.items ?? [];
  // Route-aware nav: resolve `hrefTemplate` against `/route/params` and compute
  // active-state against `/route/path` (`matchPattern` startsWith match wins;
  // otherwise the fully-resolved href matches the current path; explicit
  // `item.active` is the last fallback for static-prop callers).
  const routeParams = objectFromState(store.get('/route/params'));
  const rawPath = store.get('/route/path');
  const currentPath = typeof rawPath === 'string' ? rawPath : '';
  function resolveItemHref(item: NavItem): string {
    if (item.hrefTemplate) return resolveTemplate(item.hrefTemplate, { routeParams });
    return item.href ?? '#';
  }
  function isItemActive(item: NavItem, resolvedHref: string): boolean {
    if (currentPath.length > 0) {
      if (item.matchPattern) {
        const resolvedPattern = resolveTemplate(item.matchPattern, { routeParams });
        if (resolvedPattern.length > 0) return currentPath.startsWith(resolvedPattern);
      }
      if (resolvedHref && resolvedHref !== '#') return currentPath === resolvedHref;
    }
    return Boolean(item.active);
  }
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
          ...section.items.map((item, ii) => {
            const href = resolveItemHref(item);
            const active = isItemActive(item, href);
            return React.createElement(
              'li',
              { key: ii, className: 'rntme-sidebar-nav-item' },
              React.createElement(
                'a',
                {
                  href,
                  className: active ? 'is-active' : '',
                  'aria-current': active ? 'page' : undefined,
                },
                item.label,
                item.count !== undefined
                  ? React.createElement('span', { className: 'rntme-sidebar-nav-count' }, String(item.count))
                  : null,
              ),
            );
          }),
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

/**
 * Maps a `/route/path` segment to a breadcrumb label. Segments not in the
 * table are humanized via title-case so unknown ids (e.g. `org_*`) still
 * render. `skip: true` drops the segment entirely (used for auth-flow
 * segments that the user does not navigate to).
 */
const TOPBAR_CRUMB_LABELS: Record<string, { label?: string; skip?: boolean }> = {
  'data-model': { label: 'Data model' },
  api: { label: 'API' },
  ui: { label: 'UI' },
  graph: { label: 'Graph' },
  deployments: { label: 'Deployments' },
  'deploy-targets': { label: 'Deploy targets' },
  tokens: { label: 'API tokens' },
  audit: { label: 'Audit log' },
  projects: { label: 'Projects' },
  versions: { label: 'Version' },
  'no-org': { label: 'No organization' },
  auth: { skip: true },
  callback: { skip: true },
  login: { label: 'Login' },
};

function crumbsFromPath(path: string): Array<{ label: string; current?: boolean }> {
  const segments = path.split('/').filter(Boolean);
  const out: Array<{ label: string; current?: boolean }> = [{ label: 'platform' }];
  const labels: string[] = [];
  for (const segment of segments) {
    const entry = TOPBAR_CRUMB_LABELS[segment];
    if (entry?.skip) continue;
    if (entry?.label) labels.push(entry.label);
    else labels.push(segment);
  }
  labels.forEach((label, idx) => {
    const isLast = idx === labels.length - 1;
    out.push(isLast ? { label, current: true } : { label });
  });
  return out;
}

export function PlatformTopbar(props: {
  crumbs?: ReadonlyArray<{ label: string; current?: boolean }>;
  crumbsFromRoute?: boolean;
  actions?: ReadonlyArray<{ label: string; variant?: string; href?: string; hrefTemplate?: string }>;
}) {
  const store = useStateStore();
  const rawPath = store.get('/route/path');
  const currentPath = typeof rawPath === 'string' ? rawPath : '';
  const crumbs: ReadonlyArray<{ label: string; current?: boolean }> = props.crumbsFromRoute
    ? crumbsFromPath(currentPath)
    : props.crumbs ?? [];
  const actions = props.actions ?? [];
  const routeParams = objectFromState(store.get('/route/params'));
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
          ...actions.map((a, i) => {
            const href = actionHref(a, routeParams) ?? '#';
            return React.createElement(
              'a',
              {
                key: i,
                href,
                className: `rntme-btn is-small ${a.variant ? `is-${a.variant}` : 'is-ghost'}`,
              },
              a.label,
            );
          }),
        )
      : null,
  );
}

/* =========================================================
   PlatformAPIExplorer
   ----------------------------------------------------------
   Searchable, service-grouped HTTP endpoint catalogue with a
   side detail pane carrying Overview / Request / Response /
   Examples / Raw tabs. Reads the flattened `ProjectEndpointRow`
   rows produced by the `listProjectEndpoints` native handler
   at `/api/projects/{projectId}/endpoints`.

   On selection, the component fetches the per-endpoint
   `ProjectEndpointDetail` row from the
   `getProjectEndpointDetail` native handler via `useTransport`
   (URL template defaults to
   `/api/projects/{projectId}/endpoints/{service}/{operation}`)
   and caches it in component-local state keyed by
   `${service}:${operation}`.

   - Overview: populates the five real handler-backed fields
     (Auth, Source artifact, Handler reference, Request schema
     name, Response schema name) plus the four already surfaced
     from the catalogue rows (Service, Operation, Method, Path).
     Summary and Dependencies keep the explicit "Not yet exposed
     by handler" copy.
   - Request: renders path / query / body parameter tables; each
     row opens a side-sheet with parameter name, location chip,
     required flag, JSON path (with copy), and not-yet-exposed
     placeholders for description and allowed values.
   - Response: renders schema fields when the handler resolves
     them; status code, example body, and error responses remain
     "Not yet exposed by handler" placeholders (those fields are
     pinned constants in the handler contract).
   - Examples: renders the curl / fetch / openapi skeleton
     snippets the handler emits, with a copy-to-clipboard action
     on each.
   - Raw: renders a JSON preview of the endpoint's raw
     `bindings.json` entry (`detail.rawBinding`).
   ========================================================= */

type APIEndpointRow = {
  service: string;
  operation: string;
  method: string;
  path: string;
};

type APIEndpointParameter = {
  name: string;
  in: 'path' | 'query' | 'body';
  required: boolean;
};

type APIEndpointResponseDetail = {
  schemaName: string | null;
  fields: APIEndpointParameter[];
};

type APIEndpointExamples = {
  curl: string;
  fetch: string;
  openapi: string;
};

type APIEndpointDetail = {
  service: string;
  operation: string;
  method: string;
  path: string;
  summary: string | null;
  auth: 'required' | 'public' | null;
  sourceArtifact: { file: string; key: string } | null;
  handler: { engine: string; dialect: string; graph: string | null } | null;
  request: {
    pathParams: APIEndpointParameter[];
    queryParams: APIEndpointParameter[];
    body: { schemaName: string | null; fields: APIEndpointParameter[] } | null;
  } | null;
  response: APIEndpointResponseDetail | null;
  examples: APIEndpointExamples | null;
  rawBinding: unknown;
};

type APIDetailCacheEntry = APIEndpointDetail | { error: string };

type APIDetailTab = 'overview' | 'request' | 'response' | 'examples' | 'raw';

type APIExampleTab = 'curl' | 'fetch' | 'openapi';

type APIParameterSection = 'path' | 'query' | 'body';

type APIParameterSelection = {
  section: APIParameterSection;
  index: number;
};

const API_DETAIL_TABS: ReadonlyArray<readonly [APIDetailTab, string]> = [
  ['overview', 'Overview'],
  ['request', 'Request'],
  ['response', 'Response'],
  ['examples', 'Examples'],
  ['raw', 'Raw'],
];

const API_EXAMPLE_TABS: ReadonlyArray<readonly [APIExampleTab, string]> = [
  ['curl', 'curl'],
  ['fetch', 'fetch'],
  ['openapi', 'openapi'],
];

const API_METHODS: ReadonlyArray<string> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const API_DETAIL_PLACEHOLDER_TEXT = 'Not yet exposed by handler';

// Overview-pane deferred rows that always render the placeholder copy. The
// `Examples` row from B1 has graduated to its own tab in B2 (skeleton snippets
// are real, even if body payloads are still pinned). The `Dependencies` row
// remains deferred to Slice C.
const API_DETAIL_DEFERRED_PLACEHOLDERS: ReadonlyArray<readonly [string, string]> = [
  ['Summary', API_DETAIL_PLACEHOLDER_TEXT],
  ['Dependencies', API_DETAIL_PLACEHOLDER_TEXT],
];

function isApiEndpointParameter(value: unknown): value is APIEndpointParameter {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && (v.in === 'path' || v.in === 'query' || v.in === 'body');
}

function toAPIEndpointDetail(payload: unknown): APIEndpointDetail | { error: string } {
  if (payload === null || typeof payload !== 'object') {
    return { error: 'Invalid response shape.' };
  }
  const envelope = payload as Record<string, unknown>;
  if (envelope.status === 'error') {
    return { error: 'Endpoint detail failed to load.' };
  }
  const detailRaw = envelope.detail;
  if (!detailRaw || typeof detailRaw !== 'object') {
    return { error: 'Missing detail in response.' };
  }
  const detail = detailRaw as Record<string, unknown>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const optStr = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  const sourceArtifactRaw = detail.sourceArtifact;
  const sourceArtifact =
    sourceArtifactRaw && typeof sourceArtifactRaw === 'object'
      ? {
          file: str((sourceArtifactRaw as Record<string, unknown>).file),
          key: str((sourceArtifactRaw as Record<string, unknown>).key),
        }
      : null;
  const handlerRaw = detail.handler;
  const handler =
    handlerRaw && typeof handlerRaw === 'object'
      ? {
          engine: str((handlerRaw as Record<string, unknown>).engine),
          dialect: str((handlerRaw as Record<string, unknown>).dialect),
          graph: optStr((handlerRaw as Record<string, unknown>).graph),
        }
      : null;
  const requestRaw = detail.request;
  let request: APIEndpointDetail['request'] = null;
  if (requestRaw && typeof requestRaw === 'object') {
    const r = requestRaw as Record<string, unknown>;
    const pathParams = Array.isArray(r.pathParams)
      ? r.pathParams.filter(isApiEndpointParameter)
      : [];
    const queryParams = Array.isArray(r.queryParams)
      ? r.queryParams.filter(isApiEndpointParameter)
      : [];
    let body: { schemaName: string | null; fields: APIEndpointParameter[] } | null = null;
    if (r.body && typeof r.body === 'object') {
      const bodyRaw = r.body as Record<string, unknown>;
      const bodyFields = Array.isArray(bodyRaw.fields)
        ? bodyRaw.fields.filter(isApiEndpointParameter)
        : [];
      body = { schemaName: optStr(bodyRaw.schemaName), fields: bodyFields };
    }
    request = { pathParams, queryParams, body };
  }
  const responseRaw = detail.response;
  let response: APIEndpointResponseDetail | null = null;
  if (responseRaw && typeof responseRaw === 'object') {
    const r = responseRaw as Record<string, unknown>;
    const fields = Array.isArray(r.fields) ? r.fields.filter(isApiEndpointParameter) : [];
    response = { schemaName: optStr(r.schemaName), fields };
  }
  const examplesRaw = detail.examples;
  let examples: APIEndpointExamples | null = null;
  if (examplesRaw && typeof examplesRaw === 'object') {
    const e = examplesRaw as Record<string, unknown>;
    examples = {
      curl: str(e.curl),
      fetch: str(e.fetch),
      openapi: str(e.openapi),
    };
  }
  const auth = detail.auth === 'required' || detail.auth === 'public' ? detail.auth : null;
  return {
    service: str(detail.service),
    operation: str(detail.operation),
    method: str(detail.method).toUpperCase(),
    path: str(detail.path),
    summary: optStr(detail.summary),
    auth,
    sourceArtifact,
    handler,
    request,
    response,
    examples,
    rawBinding: detail.rawBinding,
  };
}

function substituteTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{([^}]+)\}/g, (match, key: string) => {
    const value = values[key];
    return typeof value === 'string' && value.length > 0
      ? encodeURIComponent(value)
      : match;
  });
}

function toAPIEndpointRow(row: Record<string, unknown>): APIEndpointRow {
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    service: str(row.service),
    operation: str(row.operation),
    method: str(row.method).toUpperCase(),
    path: str(row.path),
  };
}

function endpointKey(row: APIEndpointRow): string {
  return `${row.service}:${row.operation}`;
}

function parameterJsonPath(section: APIParameterSection, name: string): string {
  return `${section}.${name}`;
}

function parameterFromSelection(
  detail: APIEndpointDetail,
  selection: APIParameterSelection,
): APIEndpointParameter | null {
  if (detail.request === null) return null;
  const list =
    selection.section === 'path'
      ? detail.request.pathParams
      : selection.section === 'query'
      ? detail.request.queryParams
      : detail.request.body?.fields ?? [];
  return list[selection.index] ?? null;
}

function methodBadgeClass(method: string): string {
  const normalized = method.toUpperCase();
  const known = API_METHODS.includes(normalized);
  return `rntme-pae-method ${known ? `rntme-pae-method-${normalized}` : 'rntme-pae-method-OTHER'}`;
}

function copyToClipboard(text: string): boolean {
  if (text.length === 0) return false;
  const clip = globalThis.navigator?.clipboard;
  if (clip && typeof clip.writeText === 'function') {
    void clip.writeText(text);
    return true;
  }
  return false;
}

export function PlatformAPIExplorer(props: {
  endpointsStatePath?: string;
  summaryStatePath?: string;
  endpointDetailPathTemplate?: string;
  /**
   * Optional cross-link template for the Graph screen. When provided, the
   * Overview pane renders the `Handler` row as a link to this template
   * resolved against `/route/params` plus the handler's `graph` value.
   */
  graphHrefTemplate?: string;
  /**
   * Optional cross-link template for the PDM (data model) screen. When
   * provided, the Overview pane renders the `Request schema` and
   * `Response schema` rows as links to this template resolved against
   * `/route/params` plus the schema's `schemaName` value.
   */
  pdmHrefTemplate?: string;
}) {
  const store = useStateStore();
  // `useTransport` returns `null` in test/SSR environments without a provider.
  // The detail-fetch effect must tolerate that to keep this component
  // server-renderable and to keep the existing static `renderToStaticMarkup`
  // tests passing without forcing a transport mock.
  const transport = useTransport();
  const endpointsPath = props.endpointsStatePath ?? '/data/endpoints';
  const summaryPath = props.summaryStatePath ?? '/data/summary';
  const detailTemplate =
    props.endpointDetailPathTemplate ?? '/api/projects/{projectId}/endpoints/{service}/{operation}';
  const graphHrefTemplate = props.graphHrefTemplate ?? null;
  const pdmHrefTemplate = props.pdmHrefTemplate ?? null;
  const routeParams = objectFromState(store.get('/route/params'));

  const endpointsRaw = store.get(endpointsPath);
  // The summary path is read so the component reacts to summary updates and so
  // a future slice can display per-method counts inline; today the summary
  // grid is rendered as a sibling element on the screen spec, so the value is
  // intentionally only subscribed to (not displayed) here.
  store.get(summaryPath);
  const endpoints: APIEndpointRow[] = rowsFromState(endpointsRaw).map(toAPIEndpointRow);

  const projectIdRaw = store.get('/route/params/projectId');
  const projectId = typeof projectIdRaw === 'string' ? projectIdRaw : '';

  const [query, setQuery] = React.useState('');
  const [methodFilter, setMethodFilter] = React.useState<string>('all');
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<APIDetailTab>('overview');
  const [detailCache, setDetailCache] = React.useState<Map<string, APIDetailCacheEntry>>(
    () => new Map(),
  );
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);
  // Side-sheet state for the parameter inspector. `null` means closed.
  const [openParameter, setOpenParameter] = React.useState<APIParameterSelection | null>(null);
  // Sub-tab inside the Examples tab (curl / fetch / openapi).
  const [exampleTab, setExampleTab] = React.useState<APIExampleTab>('curl');
  // Transient toast for the copy-to-clipboard actions.
  const [copyToast, setCopyToast] = React.useState<string | null>(null);

  // Derive per-method counts from the endpoint rows so the catalogue header
  // can offer scanning aids without depending on a not-yet-exposed summary
  // shape.
  const methodCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const row of endpoints) {
      counts[row.method] = (counts[row.method] ?? 0) + 1;
    }
    return counts;
  }, [endpoints]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return endpoints.filter((row) => {
      if (methodFilter !== 'all' && row.method !== methodFilter) return false;
      if (q.length === 0) return true;
      return (
        row.service.toLowerCase().includes(q) ||
        row.operation.toLowerCase().includes(q) ||
        row.method.toLowerCase().includes(q) ||
        row.path.toLowerCase().includes(q)
      );
    });
  }, [endpoints, query, methodFilter]);

  const services = React.useMemo(
    () => uniqueSorted(filtered.map((row) => row.service)),
    [filtered],
  );

  const groups = React.useMemo(
    () =>
      services
        .map((service) => ({
          service,
          rows: filtered.filter((row) => row.service === service),
        }))
        .filter((group) => group.rows.length > 0),
    [services, filtered],
  );

  const selected =
    endpoints.find((row) => endpointKey(row) === selectedKey) ?? endpoints[0];
  const selectedFetchKey = selected ? endpointKey(selected) : null;

  // Fetch detail for the active selection via the runtime transport. Stays a
  // no-op when no transport, no selection, no projectId, or when the entry is
  // already cached, so static SSR / no-provider tests stay clean.
  React.useEffect(() => {
    if (transport === null || transport === undefined) return;
    if (selected === undefined || selectedFetchKey === null) return;
    if (projectId.length === 0) return;
    if (detailCache.has(selectedFetchKey)) return;

    let cancelled = false;
    setLoadingKey(selectedFetchKey);
    const url = substituteTemplate(detailTemplate, {
      projectId,
      service: selected.service,
      operation: selected.operation,
    });
    const fullUrl = url.startsWith('http')
      ? url
      : new globalThis.URL(url, window.location.href).toString();
    void (async () => {
      try {
        const response = await transport(new globalThis.Request(fullUrl, { method: 'GET' }));
        const payload = await response.json().catch(() => null);
        const entry = response.ok
          ? toAPIEndpointDetail(payload)
          : ({ error: `HTTP ${response.status}` } as APIDetailCacheEntry);
        if (cancelled) return;
        setDetailCache((prev) => {
          const next = new Map(prev);
          next.set(selectedFetchKey, entry);
          return next;
        });
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : String(cause);
        setDetailCache((prev) => {
          const next = new Map(prev);
          next.set(selectedFetchKey, { error: message });
          return next;
        });
      } finally {
        if (!cancelled) {
          setLoadingKey((current) => (current === selectedFetchKey ? null : current));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [transport, selected, selectedFetchKey, projectId, detailTemplate, detailCache]);

  // Auto-dismiss the copy toast so it doesn't linger across renders.
  React.useEffect(() => {
    if (copyToast === null) return;
    const win = (globalThis as { window?: typeof window }).window;
    if (!win || typeof win.setTimeout !== 'function') return;
    const handle = win.setTimeout(() => setCopyToast(null), 1600);
    return () => win.clearTimeout(handle);
  }, [copyToast]);

  // Reset the parameter side-sheet whenever the selected endpoint changes so a
  // stale parameter index from a prior endpoint never points at a different
  // endpoint's parameter list.
  React.useEffect(() => {
    setOpenParameter(null);
  }, [selectedFetchKey]);

  // Escape-to-close for the parameter side-sheet. Only attaches the listener
  // when the sheet is actually open so the rest of the page keeps native
  // behaviour for the Escape key.
  React.useEffect(() => {
    if (openParameter === null) return;
    const doc = (globalThis as { document?: typeof document }).document;
    if (!doc || typeof doc.addEventListener !== 'function') return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpenParameter(null);
    };
    doc.addEventListener('keydown', onKeyDown);
    return () => doc.removeEventListener('keydown', onKeyDown);
  }, [openParameter]);

  // Bare loading shell when the store has not produced a value yet.
  if (endpointsRaw === undefined) {
    return React.createElement(
      'section',
      {
        className: 'rntme-pae',
        'data-rntme-component': 'APIExplorer',
        'data-state-path': endpointsPath,
      },
      React.createElement('p', { className: 'rntme-pae-loading' }, 'Loading endpoints…'),
    );
  }

  const totalEndpoints = endpoints.length;

  return React.createElement(
    'section',
    {
      className: 'rntme-pae',
      'data-rntme-component': 'APIExplorer',
      'data-state-path': endpointsPath,
      'data-summary-path': summaryPath,
    },
    React.createElement(
      'div',
      { className: 'rntme-pae-grid' },
      React.createElement(
        'aside',
        { className: 'rntme-pae-list', 'aria-label': 'Endpoint catalogue' },
        React.createElement(
          'div',
          { className: 'rntme-pae-controls' },
          React.createElement('input', {
            type: 'search',
            className: 'rntme-pae-search',
            value: query,
            placeholder: 'Search endpoints',
            'aria-label': 'Search endpoints',
            onChange: (event: React.ChangeEvent<{ value: string }>) =>
              setQuery(event.currentTarget.value),
            onInput: (event: React.FormEvent<{ value: string }>) =>
              setQuery(event.currentTarget.value),
          }),
          React.createElement(
            'div',
            {
              className: 'rntme-pae-filters',
              role: 'group',
              'aria-label': 'Filter endpoints by HTTP method',
            },
            React.createElement(
              'button',
              {
                type: 'button',
                className: `rntme-pae-chip ${methodFilter === 'all' ? 'is-active' : ''}`,
                onClick: () => setMethodFilter('all'),
                'data-pae-method-filter': 'all',
              },
              'All',
              React.createElement('span', null, String(totalEndpoints)),
            ),
            ...API_METHODS.map((method) =>
              React.createElement(
                'button',
                {
                  key: method,
                  type: 'button',
                  className: `rntme-pae-chip ${methodFilter === method ? 'is-active' : ''}`,
                  onClick: () => setMethodFilter(method),
                  'data-pae-method-filter': method,
                },
                method,
                React.createElement('span', null, String(methodCounts[method] ?? 0)),
              ),
            ),
          ),
        ),
        groups.length === 0
          ? React.createElement(
              'p',
              { className: 'rntme-pae-empty' },
              totalEndpoints === 0 ? 'No endpoints found' : 'No endpoints match.',
            )
          : groups.map((group) =>
              React.createElement(
                'section',
                { key: group.service, className: 'rntme-pae-group' },
                React.createElement(
                  'div',
                  { className: 'rntme-pae-group-head' },
                  React.createElement('span', null, group.service),
                  React.createElement('b', null, String(group.rows.length)),
                ),
                ...group.rows.map((row) => {
                  const key = endpointKey(row);
                  const isSelected = key === (selected ? endpointKey(selected) : null);
                  return React.createElement(
                    'button',
                    {
                      key,
                      type: 'button',
                      className: `rntme-pae-row ${isSelected ? 'is-active' : ''}`,
                      'data-pae-endpoint': key,
                      onClick: () => setSelectedKey(key),
                    },
                    React.createElement(
                      'span',
                      { className: methodBadgeClass(row.method) },
                      row.method || '—',
                    ),
                    React.createElement(
                      'span',
                      { className: 'rntme-pae-row-path' },
                      row.path || '—',
                    ),
                    React.createElement(
                      'span',
                      { className: 'rntme-pae-row-op' },
                      row.operation || '—',
                    ),
                  );
                }),
              ),
            ),
      ),
      React.createElement(
        'div',
        { className: 'rntme-pae-detail' },
        selected
          ? renderAPIDetail({
              endpoint: selected,
              detailEntry: selectedFetchKey === null ? undefined : detailCache.get(selectedFetchKey),
              isLoading: loadingKey !== null && loadingKey === selectedFetchKey,
              activeTab,
              onSelectTab: setActiveTab,
              onOpenParameter: setOpenParameter,
              exampleTab,
              onSelectExampleTab: setExampleTab,
              onCopyText: (text, label) => {
                const ok = copyToClipboard(text);
                setCopyToast(ok ? `Copied ${label}` : `Could not copy ${label}`);
              },
              graphHrefTemplate,
              pdmHrefTemplate,
              routeParams,
            })
          : React.createElement(
              'div',
              { className: 'rntme-pae-detail-empty' },
              React.createElement(
                'p',
                null,
                'Select an endpoint to inspect it.',
              ),
            ),
      ),
    ),
    renderAPIParameterSheet({
      detail:
        selectedFetchKey !== null
          ? (() => {
              const entry = detailCache.get(selectedFetchKey);
              return entry !== undefined && !('error' in entry) ? entry : null;
            })()
          : null,
      selection: openParameter,
      onClose: () => setOpenParameter(null),
      onCopyText: (text, label) => {
        const ok = copyToClipboard(text);
        setCopyToast(ok ? `Copied ${label}` : `Could not copy ${label}`);
      },
    }),
    copyToast !== null
      ? React.createElement(
          'div',
          {
            className: 'rntme-pae-toast',
            role: 'status',
            'data-pae-toast': 'true',
          },
          copyToast,
        )
      : null,
  );
}

function formatRequestSchemaName(detail: APIEndpointDetail): string | null {
  const request = detail.request;
  if (request === null) return null;
  if (request.body !== null && request.body.schemaName !== null) return request.body.schemaName;
  return null;
}

type APIDetailRenderInput = {
  endpoint: APIEndpointRow;
  detailEntry: APIDetailCacheEntry | undefined;
  isLoading: boolean;
  activeTab: APIDetailTab;
  onSelectTab: (tab: APIDetailTab) => void;
  onOpenParameter: (selection: APIParameterSelection) => void;
  exampleTab: APIExampleTab;
  onSelectExampleTab: (tab: APIExampleTab) => void;
  onCopyText: (text: string, label: string) => void;
  graphHrefTemplate?: string | null;
  pdmHrefTemplate?: string | null;
  routeParams?: Record<string, unknown>;
};

/**
 * Resolve a per-row API explorer cross-link template against the active route
 * params plus an extra context (e.g. `graph` or `schemaName`). Returns `null`
 * when the template is absent or when the extra value is empty so callers can
 * fall back to plain-text rendering.
 */
function resolveCrossLink(
  template: string | null | undefined,
  routeParams: Record<string, unknown>,
  extra: Record<string, string>,
): string | null {
  if (template === null || template === undefined || template.length === 0) return null;
  const allEmpty = Object.values(extra).every((v) => v.length === 0);
  if (allEmpty) return null;
  const merged: Record<string, unknown> = { ...routeParams, ...extra };
  return resolveTemplate(template, { routeParams: merged });
}

function renderAPIDetail(input: APIDetailRenderInput): React.ReactElement {
  const {
    endpoint,
    detailEntry,
    isLoading,
    activeTab,
    onSelectTab,
    onOpenParameter,
    exampleTab,
    onSelectExampleTab,
    onCopyText,
    graphHrefTemplate,
    pdmHrefTemplate,
    routeParams,
  } = input;
  const detail =
    detailEntry !== undefined && !('error' in detailEntry)
      ? (detailEntry as APIEndpointDetail)
      : null;
  const detailError = detailEntry !== undefined && 'error' in detailEntry ? detailEntry.error : null;

  const handlerSummary = detail?.handler
    ? `${detail.handler.engine || '—'} / ${detail.handler.dialect || '—'}${
        detail.handler.graph ? ` · ${detail.handler.graph}` : ''
      }`
    : null;
  const sourceArtifactSummary = detail?.sourceArtifact
    ? `${detail.sourceArtifact.file} · ${detail.sourceArtifact.key}`
    : null;
  const requestSchemaName = detail !== null ? formatRequestSchemaName(detail) : null;
  const responseSchemaName = detail?.response?.schemaName ?? null;
  const authValue = detail?.auth ?? null;

  // Resolve optional cross-link templates so the Overview pane can render
  // `Source artifact` / `Handler` as a link to the Graph screen and
  // `Request schema` / `Response schema` as links to the PDM (data-model)
  // screen. Templates are resolved against `/route/params` plus a per-row
  // value (`graph` for handler/source-artifact links; `schemaName` for
  // schema links). When the template is absent or the per-row value is
  // empty, the link falls back to plain text.
  const params = routeParams ?? {};
  const graph = detail?.handler?.graph ?? '';
  const handlerLink = handlerSummary === null
    ? null
    : resolveCrossLink(graphHrefTemplate ?? null, params, { graph });
  const sourceArtifactLink = sourceArtifactSummary === null
    ? null
    : resolveCrossLink(graphHrefTemplate ?? null, params, { graph });
  const requestSchemaLink = requestSchemaName === null
    ? null
    : resolveCrossLink(pdmHrefTemplate ?? null, params, { schemaName: requestSchemaName });
  const responseSchemaLink = responseSchemaName === null
    ? null
    : resolveCrossLink(pdmHrefTemplate ?? null, params, { schemaName: responseSchemaName });

  const handlerBackedRows: ReadonlyArray<
    readonly [string, string | null, string | null]
  > = [
    [
      'Auth',
      authValue === 'required' ? 'Required' : authValue === 'public' ? 'Public' : null,
      null,
    ],
    ['Source artifact', sourceArtifactSummary, sourceArtifactLink],
    ['Handler', handlerSummary, handlerLink],
    ['Request schema', requestSchemaName, requestSchemaLink],
    ['Response schema', responseSchemaName, responseSchemaLink],
  ];

  return React.createElement(
    'article',
    { className: 'rntme-pae-card' },
    React.createElement(
      'header',
      { className: 'rntme-pae-detail-head' },
      React.createElement('span', { className: 'rntme-pae-eyebrow' }, 'HTTP endpoint'),
      React.createElement(
        'div',
        { className: 'rntme-pae-detail-line' },
        React.createElement(
          'span',
          { className: methodBadgeClass(endpoint.method) },
          endpoint.method || '—',
        ),
        React.createElement('h2', { className: 'rntme-pae-detail-path' }, endpoint.path || '—'),
      ),
      React.createElement(
        'p',
        { className: 'rntme-pae-detail-sub' },
        endpoint.service ? `${endpoint.service} · ${endpoint.operation || '—'}` : endpoint.operation || '—',
      ),
    ),
    React.createElement(
      'div',
      { className: 'rntme-pae-tabs', role: 'tablist', 'aria-label': 'Endpoint detail tabs' },
      ...API_DETAIL_TABS.map(([tab, label]) =>
        React.createElement(
          'button',
          {
            key: tab,
            type: 'button',
            role: 'tab',
            className: `rntme-pae-tab ${activeTab === tab ? 'is-active' : ''}`,
            'aria-selected': activeTab === tab,
            'data-pae-tab': tab,
            onClick: () => onSelectTab(tab),
          },
          label,
        ),
      ),
    ),
    activeTab === 'overview'
      ? renderOverviewPane({
          endpoint,
          detailError,
          isLoading,
          handlerBackedRows,
        })
      : activeTab === 'request'
      ? renderRequestPane({ detail, detailError, isLoading, onOpenParameter })
      : activeTab === 'response'
      ? renderResponsePane({ detail, detailError, isLoading })
      : activeTab === 'examples'
      ? renderExamplesPane({
          detail,
          detailError,
          isLoading,
          activeExampleTab: exampleTab,
          onSelectExampleTab,
          onCopyText,
        })
      : renderRawPane({ detail, detailError, isLoading }),
  );
}

function renderOverviewPane(input: {
  endpoint: APIEndpointRow;
  detailError: string | null;
  isLoading: boolean;
  handlerBackedRows: ReadonlyArray<readonly [string, string | null, string | null]>;
}): React.ReactElement {
  const { endpoint, detailError, isLoading, handlerBackedRows } = input;
  type Row = readonly [string, string, boolean, string | null];
  const baseRows: Row[] = [
    ['Service', endpoint.service || '—', false, null],
    ['Operation', endpoint.operation || '—', false, null],
    ['Method', endpoint.method || '—', false, null],
    ['Path', endpoint.path || '—', false, null],
  ];
  const detailDerivedRows: Row[] = handlerBackedRows.map(([label, value, href]) => {
    if (value !== null && value.length > 0) {
      return [label, value, false, href];
    }
    if (isLoading) {
      return [label, 'Loading…', true, null];
    }
    if (detailError !== null) {
      return [label, API_DETAIL_PLACEHOLDER_TEXT, true, null];
    }
    return [label, API_DETAIL_PLACEHOLDER_TEXT, true, null];
  });
  const placeholderRows: Row[] = API_DETAIL_DEFERRED_PLACEHOLDERS.map(
    ([label, value]) => [label, value, true, null] as Row,
  );
  const overviewRows: ReadonlyArray<Row> = [...baseRows, ...detailDerivedRows, ...placeholderRows];
  return React.createElement(
    'section',
    {
      className: 'rntme-pae-overview',
      role: 'tabpanel',
      'aria-label': 'Endpoint overview',
      'data-pae-pane': 'overview',
    },
    ...overviewRows.map(([label, value, placeholder, href]) => {
      const valueChild =
        href !== null && href.length > 0
          ? React.createElement(
              'a',
              {
                className: 'rntme-pae-overview-link',
                href,
                'data-pae-overview-link': label,
              },
              value,
            )
          : value;
      return React.createElement(
        'div',
        { key: label, className: 'rntme-pae-overview-row' },
        React.createElement('span', { className: 'rntme-pae-overview-label' }, label),
        React.createElement(
          'span',
          {
            className: `rntme-pae-overview-value${placeholder ? ' is-placeholder' : ''}`,
            'data-pae-placeholder': placeholder ? 'true' : 'false',
          },
          valueChild,
        ),
      );
    }),
  );
}

function renderRawPane(input: {
  detail: APIEndpointDetail | null;
  detailError: string | null;
  isLoading: boolean;
}): React.ReactElement {
  const { detail, detailError, isLoading } = input;
  let body: string;
  if (detail !== null) {
    try {
      body = JSON.stringify(detail.rawBinding ?? null, null, 2);
    } catch {
      body = '"Unable to serialize raw binding."';
    }
  } else if (isLoading) {
    body = 'Loading…';
  } else if (detailError !== null) {
    body = `Failed to load raw binding: ${detailError}`;
  } else {
    body = API_DETAIL_PLACEHOLDER_TEXT;
  }
  return React.createElement(
    'section',
    {
      className: 'rntme-pae-raw',
      role: 'tabpanel',
      'aria-label': 'Endpoint raw binding',
      'data-pae-pane': 'raw',
    },
    React.createElement(
      'pre',
      { className: 'rntme-pae-raw-pre', 'data-pae-raw': 'true' },
      body,
    ),
  );
}

function renderPaneFallback(args: {
  isLoading: boolean;
  detailError: string | null;
  loadedNullCopy: string;
}): React.ReactElement {
  const { isLoading, detailError, loadedNullCopy } = args;
  if (isLoading) {
    return React.createElement(
      'p',
      { className: 'rntme-pae-pane-fallback' },
      'Loading…',
    );
  }
  if (detailError !== null) {
    return React.createElement(
      'p',
      { className: 'rntme-pae-pane-fallback is-error' },
      `Failed to load detail: ${detailError}`,
    );
  }
  return React.createElement(
    'p',
    {
      className: 'rntme-pae-pane-fallback is-placeholder',
      'data-pae-placeholder': 'true',
    },
    loadedNullCopy,
  );
}

function renderRequestPane(input: {
  detail: APIEndpointDetail | null;
  detailError: string | null;
  isLoading: boolean;
  onOpenParameter: (selection: APIParameterSelection) => void;
}): React.ReactElement {
  const { detail, detailError, isLoading, onOpenParameter } = input;
  if (detail === null || detail.request === null) {
    return React.createElement(
      'section',
      {
        className: 'rntme-pae-req',
        role: 'tabpanel',
        'aria-label': 'Endpoint request',
        'data-pae-pane': 'request',
      },
      renderPaneFallback({
        isLoading,
        detailError,
        loadedNullCopy: API_DETAIL_PLACEHOLDER_TEXT,
      }),
    );
  }

  const { pathParams, queryParams, body } = detail.request;
  const sections: React.ReactNode[] = [];

  if (pathParams.length > 0) {
    sections.push(
      renderRequestSection({
        key: 'path',
        section: 'path',
        title: 'Path parameters',
        params: pathParams,
        caption: null,
        onOpenParameter,
      }),
    );
  }
  if (queryParams.length > 0) {
    sections.push(
      renderRequestSection({
        key: 'query',
        section: 'query',
        title: 'Query parameters',
        params: queryParams,
        caption: null,
        onOpenParameter,
      }),
    );
  }
  if (body !== null && body.fields.length > 0) {
    sections.push(
      renderRequestSection({
        key: 'body',
        section: 'body',
        title: 'Body parameters',
        params: body.fields,
        caption: body.schemaName !== null ? `Schema: ${body.schemaName}` : null,
        onOpenParameter,
      }),
    );
  }

  if (sections.length === 0) {
    sections.push(
      React.createElement(
        'p',
        {
          key: 'empty',
          className: 'rntme-pae-req-empty',
          'data-pae-req-empty': 'true',
        },
        'No parameters declared.',
      ),
    );
  }

  return React.createElement(
    'section',
    {
      className: 'rntme-pae-req',
      role: 'tabpanel',
      'aria-label': 'Endpoint request',
      'data-pae-pane': 'request',
    },
    ...sections,
  );
}

function renderRequestSection(args: {
  key: string;
  section: APIParameterSection;
  title: string;
  params: ReadonlyArray<APIEndpointParameter>;
  caption: string | null;
  onOpenParameter: (selection: APIParameterSelection) => void;
}): React.ReactElement {
  const { key, section, title, params, caption, onOpenParameter } = args;
  return React.createElement(
    'section',
    { key, className: 'rntme-pae-req-section', 'data-pae-req-section': section },
    React.createElement(
      'header',
      { className: 'rntme-pae-req-section-head' },
      React.createElement('h3', { className: 'rntme-pae-req-section-title' }, title),
      caption !== null
        ? React.createElement(
            'span',
            { className: 'rntme-pae-req-section-caption' },
            caption,
          )
        : null,
    ),
    React.createElement(
      'div',
      { role: 'table', className: 'rntme-pae-req-table' },
      React.createElement(
        'div',
        { role: 'row', className: 'rntme-pae-req-row is-header' },
        React.createElement('span', { role: 'columnheader' }, 'Name'),
        React.createElement('span', { role: 'columnheader' }, 'Required'),
        React.createElement('span', { role: 'columnheader' }, 'JSON path'),
      ),
      ...params.map((param, index) => {
        const jsonPath = parameterJsonPath(section, param.name);
        return React.createElement(
          'button',
          {
            key: `${section}:${param.name}:${index}`,
            type: 'button',
            role: 'row',
            className: 'rntme-pae-req-row',
            'data-pae-param-row': `${section}:${param.name}`,
            onClick: () => onOpenParameter({ section, index }),
          },
          React.createElement(
            'span',
            { role: 'cell', className: 'rntme-pae-req-name' },
            param.name,
          ),
          React.createElement(
            'span',
            { role: 'cell', className: 'rntme-pae-req-required' },
            param.required ? 'Yes' : 'No',
          ),
          React.createElement(
            'code',
            { role: 'cell', className: 'rntme-pae-req-jsonpath' },
            jsonPath,
          ),
        );
      }),
    ),
  );
}

function renderResponsePane(input: {
  detail: APIEndpointDetail | null;
  detailError: string | null;
  isLoading: boolean;
}): React.ReactElement {
  const { detail, detailError, isLoading } = input;
  if (detail === null) {
    return React.createElement(
      'section',
      {
        className: 'rntme-pae-res',
        role: 'tabpanel',
        'aria-label': 'Endpoint response',
        'data-pae-pane': 'response',
      },
      renderPaneFallback({
        isLoading,
        detailError,
        loadedNullCopy: API_DETAIL_PLACEHOLDER_TEXT,
      }),
    );
  }

  const response = detail.response;
  const fields = response?.fields ?? [];
  const schemaName = response?.schemaName ?? null;

  // 1) Schema fields section
  let schemaSection: React.ReactNode;
  if (fields.length === 0 && schemaName === null) {
    schemaSection = React.createElement(
      'section',
      {
        key: 'schema',
        className: 'rntme-pae-res-section',
        'data-pae-res-section': 'schema',
      },
      React.createElement(
        'header',
        { className: 'rntme-pae-res-section-head' },
        React.createElement('h3', { className: 'rntme-pae-res-section-title' }, 'Schema fields'),
      ),
      React.createElement(
        'p',
        {
          className: 'rntme-pae-res-placeholder is-placeholder',
          'data-pae-placeholder': 'true',
        },
        'Response schema not yet exposed by handler',
      ),
    );
  } else {
    schemaSection = React.createElement(
      'section',
      {
        key: 'schema',
        className: 'rntme-pae-res-section',
        'data-pae-res-section': 'schema',
      },
      React.createElement(
        'header',
        { className: 'rntme-pae-res-section-head' },
        React.createElement('h3', { className: 'rntme-pae-res-section-title' }, 'Schema fields'),
        schemaName !== null
          ? React.createElement(
              'span',
              { className: 'rntme-pae-res-section-caption' },
              `Schema: ${schemaName}`,
            )
          : null,
      ),
      fields.length === 0
        ? React.createElement(
            'p',
            {
              className: 'rntme-pae-res-placeholder is-placeholder',
              'data-pae-placeholder': 'true',
            },
            API_DETAIL_PLACEHOLDER_TEXT,
          )
        : React.createElement(
            'div',
            { role: 'table', className: 'rntme-pae-res-table' },
            React.createElement(
              'div',
              { role: 'row', className: 'rntme-pae-res-row is-header' },
              React.createElement('span', { role: 'columnheader' }, 'Name'),
              React.createElement('span', { role: 'columnheader' }, 'Required'),
              React.createElement('span', { role: 'columnheader' }, 'JSON path'),
            ),
            ...fields.map((field, index) =>
              React.createElement(
                'div',
                {
                  key: `${field.name}:${index}`,
                  role: 'row',
                  className: 'rntme-pae-res-row',
                  'data-pae-res-field': field.name,
                },
                React.createElement(
                  'span',
                  { role: 'cell', className: 'rntme-pae-res-name' },
                  field.name,
                ),
                React.createElement(
                  'span',
                  { role: 'cell', className: 'rntme-pae-res-required' },
                  field.required ? 'Yes' : 'No',
                ),
                React.createElement(
                  'code',
                  { role: 'cell', className: 'rntme-pae-res-jsonpath' },
                  parameterJsonPath('body', field.name),
                ),
              ),
            ),
          ),
    );
  }

  // 2) Status code chip section
  const statusSection = React.createElement(
    'section',
    {
      key: 'status',
      className: 'rntme-pae-res-section',
      'data-pae-res-section': 'status',
    },
    React.createElement(
      'header',
      { className: 'rntme-pae-res-section-head' },
      React.createElement('h3', { className: 'rntme-pae-res-section-title' }, 'Status code'),
    ),
    React.createElement(
      'span',
      {
        className: 'rntme-pae-res-status is-placeholder',
        'data-pae-placeholder': 'true',
      },
      API_DETAIL_PLACEHOLDER_TEXT,
    ),
  );

  // 3) Example block section
  const exampleSection = React.createElement(
    'section',
    {
      key: 'example',
      className: 'rntme-pae-res-section',
      'data-pae-res-section': 'example',
    },
    React.createElement(
      'header',
      { className: 'rntme-pae-res-section-head' },
      React.createElement('h3', { className: 'rntme-pae-res-section-title' }, 'Example body'),
    ),
    React.createElement(
      'pre',
      {
        className: 'rntme-pae-res-example is-placeholder',
        'data-pae-placeholder': 'true',
      },
      API_DETAIL_PLACEHOLDER_TEXT,
    ),
  );

  // 4) Errors section
  const errorsSection = React.createElement(
    'section',
    {
      key: 'errors',
      className: 'rntme-pae-res-section',
      'data-pae-res-section': 'errors',
    },
    React.createElement(
      'header',
      { className: 'rntme-pae-res-section-head' },
      React.createElement('h3', { className: 'rntme-pae-res-section-title' }, 'Error responses'),
    ),
    React.createElement(
      'p',
      {
        className: 'rntme-pae-res-errors is-placeholder',
        'data-pae-placeholder': 'true',
      },
      API_DETAIL_PLACEHOLDER_TEXT,
    ),
  );

  return React.createElement(
    'section',
    {
      className: 'rntme-pae-res',
      role: 'tabpanel',
      'aria-label': 'Endpoint response',
      'data-pae-pane': 'response',
    },
    schemaSection,
    statusSection,
    exampleSection,
    errorsSection,
  );
}

function renderExamplesPane(input: {
  detail: APIEndpointDetail | null;
  detailError: string | null;
  isLoading: boolean;
  activeExampleTab: APIExampleTab;
  onSelectExampleTab: (tab: APIExampleTab) => void;
  onCopyText: (text: string, label: string) => void;
}): React.ReactElement {
  const { detail, detailError, isLoading, activeExampleTab, onSelectExampleTab, onCopyText } =
    input;
  if (detail === null || detail.examples === null) {
    return React.createElement(
      'section',
      {
        className: 'rntme-pae-examples',
        role: 'tabpanel',
        'aria-label': 'Endpoint examples',
        'data-pae-pane': 'examples',
      },
      renderPaneFallback({
        isLoading,
        detailError,
        loadedNullCopy: API_DETAIL_PLACEHOLDER_TEXT,
      }),
    );
  }
  const snippet =
    activeExampleTab === 'curl'
      ? detail.examples.curl
      : activeExampleTab === 'fetch'
      ? detail.examples.fetch
      : detail.examples.openapi;
  const isEmpty = snippet.length === 0;
  return React.createElement(
    'section',
    {
      className: 'rntme-pae-examples',
      role: 'tabpanel',
      'aria-label': 'Endpoint examples',
      'data-pae-pane': 'examples',
    },
    React.createElement(
      'div',
      {
        className: 'rntme-pae-examples-subtabs',
        role: 'tablist',
        'aria-label': 'Example format',
      },
      ...API_EXAMPLE_TABS.map(([tab, label]) =>
        React.createElement(
          'button',
          {
            key: tab,
            type: 'button',
            role: 'tab',
            className: `rntme-pae-examples-subtab ${
              activeExampleTab === tab ? 'is-active' : ''
            }`,
            'aria-selected': activeExampleTab === tab,
            'data-pae-example-tab': tab,
            onClick: () => onSelectExampleTab(tab),
          },
          label,
        ),
      ),
    ),
    React.createElement(
      'div',
      { className: 'rntme-pae-examples-body' },
      React.createElement(
        'div',
        { className: 'rntme-pae-examples-actions' },
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'rntme-pae-examples-copy',
            'data-pae-example-copy': activeExampleTab,
            disabled: isEmpty,
            onClick: () => onCopyText(snippet, `${activeExampleTab} example`),
          },
          'Copy',
        ),
      ),
      React.createElement(
        'pre',
        {
          className: `rntme-pae-examples-snippet${isEmpty ? ' is-placeholder' : ''}`,
          'data-pae-example-snippet': activeExampleTab,
          'data-pae-placeholder': isEmpty ? 'true' : 'false',
        },
        isEmpty ? API_DETAIL_PLACEHOLDER_TEXT : snippet,
      ),
    ),
  );
}

function renderAPIParameterSheet(input: {
  detail: APIEndpointDetail | null;
  selection: APIParameterSelection | null;
  onClose: () => void;
  onCopyText: (text: string, label: string) => void;
}): React.ReactNode {
  const { detail, selection, onClose, onCopyText } = input;
  if (selection === null || detail === null) return null;
  const param = parameterFromSelection(detail, selection);
  if (param === null) return null;
  const jsonPath = parameterJsonPath(selection.section, param.name);
  return React.createElement(
    'div',
    { className: 'rntme-pae-side-sheet', 'data-pae-side-sheet': 'open' },
    React.createElement('button', {
      type: 'button',
      className: 'rntme-pae-side-sheet-backdrop',
      'aria-label': 'Close parameter detail',
      'data-pae-side-sheet-backdrop': 'true',
      onClick: onClose,
    }),
    React.createElement(
      'aside',
      {
        className: 'rntme-pae-side-sheet-panel',
        role: 'dialog',
        'aria-label': 'Parameter detail',
      },
      React.createElement(
        'header',
        { className: 'rntme-pae-side-sheet-header' },
        React.createElement(
          'div',
          { className: 'rntme-pae-side-sheet-heading' },
          React.createElement('h3', { className: 'rntme-pae-side-sheet-title' }, param.name),
          React.createElement(
            'span',
            {
              className: `rntme-pae-side-sheet-chip rntme-pae-side-sheet-chip-${selection.section}`,
              'data-pae-side-sheet-chip': selection.section,
            },
            selection.section,
          ),
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'rntme-pae-side-sheet-close',
            'aria-label': 'Close parameter detail',
            'data-pae-side-sheet-close': 'true',
            onClick: onClose,
          },
          '×',
        ),
      ),
      React.createElement(
        'dl',
        { className: 'rntme-pae-side-sheet-list' },
        React.createElement('dt', null, 'Required'),
        React.createElement('dd', null, param.required ? 'Yes' : 'No'),
        React.createElement('dt', null, 'JSON path'),
        React.createElement(
          'dd',
          { className: 'rntme-pae-side-sheet-jsonpath' },
          React.createElement('code', null, jsonPath),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'rntme-pae-side-sheet-copy',
              'data-pae-side-sheet-copy': 'true',
              onClick: () => onCopyText(jsonPath, 'JSON path'),
            },
            'Copy',
          ),
        ),
        React.createElement('dt', null, 'Description'),
        React.createElement(
          'dd',
          {
            className: 'is-placeholder',
            'data-pae-placeholder': 'true',
          },
          API_DETAIL_PLACEHOLDER_TEXT,
        ),
        React.createElement('dt', null, 'Allowed values'),
        React.createElement(
          'dd',
          {
            className: 'is-placeholder',
            'data-pae-placeholder': 'true',
          },
          API_DETAIL_PLACEHOLDER_TEXT,
        ),
      ),
    ),
  );
}

export function PlatformPage(props: { children?: React.ReactNode }) {
  return React.createElement('section', { className: 'rntme-page' }, props.children);
}

export function PlatformBox(props: { className?: string; as?: string; children?: React.ReactNode }) {
  const tag = props.as ?? 'div';
  return React.createElement(tag, { className: props.className }, props.children);
}
