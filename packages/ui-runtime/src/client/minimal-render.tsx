import * as React from 'react';
import type { JsonRenderElement, JsonRenderSpec, LayoutSpec, RouteSpec } from '@rntme/ui';
import type { StateStore } from './state-store.js';

export type ActionHandlers = Record<string, (params?: unknown) => void | Promise<void>>;

type RenderCtx = {
  elements: Record<string, JsonRenderElement | undefined>;
  store: StateStore;
  handlers: ActionHandlers;
  /** When rendering a layout, the page to inject into the `main` slot. */
  page?: JsonRenderSpec | undefined;
  /** Base path for FormField values (e.g. `/form`). */
  formBase?: string | undefined;
};

function resolveValue(v: unknown, store: StateStore): unknown {
  if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
    return store.get((v as { $state: string }).$state);
  }
  return v;
}

function useStoreSnapshot(store: StateStore): void {
  const [, bump] = React.useState(0);
  React.useEffect(() => store.subscribe('', () => bump((n) => n + 1)), [store]);
}

function renderChildren(
  ids: string[],
  ctx: RenderCtx,
): React.ReactNode {
  return ids.map((id) => (
    <React.Fragment key={id}>{renderElement(id, ctx)}</React.Fragment>
  ));
}

function renderElement(elId: string, ctx: RenderCtx): React.ReactNode {
  const el = ctx.elements[elId];
  if (!el) return null;

  if (el.type === 'Slot' && (el.props as { name?: string }).name === 'main' && ctx.page) {
    return renderElement(ctx.page.root, {
      ...ctx,
      elements: ctx.page.elements,
      page: undefined,
      formBase: undefined,
    });
  }

  const props = el.props as Record<string, unknown>;
  const watch = el.watch;

  switch (el.type) {
    case 'Stack': {
      const dir = props.direction === 'horizontal' ? 'row' : 'column';
      const gap = Number(props.gap ?? 2) * 4;
      return (
        <div style={{ display: 'flex', flexDirection: dir, gap: `${gap}px` }}>
          {renderChildren(el.children, ctx)}
        </div>
      );
    }
    case 'Heading': {
      const level = Number(props.level ?? 2);
      const text = String(props.text ?? '');
      const tag = `h${Math.min(6, Math.max(1, level))}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return React.createElement(tag, { style: { margin: 0 } }, text);
    }
    case 'Text': {
      const text = String(props.text ?? '');
      return <p style={{ margin: 0 }}>{text}</p>;
    }
    case 'Divider':
      return <hr style={{ width: '100%', border: 'none', borderTop: '1px solid #ddd' }} />;
    case 'Button': {
      const label = String(props.label ?? 'Button');
      const variant = props.variant === 'primary' ? 'primary' : 'default';
      const bg = variant === 'primary' ? '#2563eb' : '#e5e7eb';
      const fg = variant === 'primary' ? '#fff' : '#111';
      const clickAction = watch?.click?.action;
      return (
        <button
          type="button"
          style={{
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: bg,
            color: fg,
            fontWeight: 500,
          }}
          onClick={() => {
            if (clickAction && ctx.handlers[clickAction]) void ctx.handlers[clickAction]();
          }}
        >
          {label}
        </button>
      );
    }
    case 'Table': {
      const rowsProp = resolveValue(props.rows, ctx.store);
      const columns = (props.columns as string[] | undefined) ?? [];
      const rows = Array.isArray(rowsProp) ? (rowsProp as Record<string, unknown>[]) : [];
      return (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    style={{
                      textAlign: 'left',
                      borderBottom: '1px solid #ddd',
                      padding: '8px 6px',
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c} style={{ borderBottom: '1px solid #eee', padding: '6px' }}>
                      {formatCell(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'Form': {
      const base = String(props.statePath ?? '/form');
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {renderChildren(el.children, { ...ctx, formBase: base })}
        </div>
      );
    }
    case 'FormField': {
      const name = String(props.name ?? '');
      const label = String(props.label ?? name);
      const typ = (props.type as string | undefined) ?? 'text';
      const path = ctx.formBase ? `${ctx.formBase}/${name}` : `/${name}`;
      const raw = ctx.store.get(path);
      const value = raw === undefined || raw === null ? '' : String(raw);
      return (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          <input
            type={typ === 'number' ? 'number' : 'text'}
            value={value}
            style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
            onChange={(e) => {
              const v = e.target.value;
              if (typ === 'number') {
                const n = Number(v);
                ctx.store.set(path, v === '' ? undefined : Number.isFinite(n) ? n : v);
              } else {
                ctx.store.set(path, v);
              }
            }}
          />
        </label>
      );
    }
    case 'Input': {
      const name = String(props.name ?? 'input');
      const path = ctx.formBase ? `${ctx.formBase}/${name}` : `/${name}`;
      const raw = ctx.store.get(path);
      const value = raw === undefined || raw === null ? '' : String(raw);
      return (
        <input
          type="text"
          value={value}
          placeholder={String(props.placeholder ?? '')}
          style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc', minWidth: 200 }}
          onChange={(e) => ctx.store.set(path, e.target.value)}
        />
      );
    }
    default:
      return (
        <div style={{ color: '#666', fontSize: 12 }}>
          Unsupported component: {el.type} ({elId})
        </div>
      );
  }
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export type RouteViewProps = {
  route: RouteSpec;
  layout?: LayoutSpec | undefined;
  store: StateStore;
  handlers: ActionHandlers;
};

export function RouteView(props: RouteViewProps): React.ReactElement {
  useStoreSnapshot(props.store);
  const { route, layout } = props;
  if (layout) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        {renderElement(layout.spec.root, {
          elements: layout.spec.elements,
          store: props.store,
          handlers: props.handlers,
          page: route.page,
        })}
      </div>
    );
  }
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      {renderElement(route.page.root, {
        elements: route.page.elements,
        store: props.store,
        handlers: props.handlers,
      })}
    </div>
  );
}
