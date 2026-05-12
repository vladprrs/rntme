import { afterEach } from 'bun:test';
import { mock } from 'bun:test';
import * as React from 'react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://ui-runtime.test/',
});

Object.defineProperties(globalThis, {
  window: { configurable: true, value: dom.window },
  document: { configurable: true, value: dom.window.document },
  navigator: { configurable: true, value: dom.window.navigator },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  Element: { configurable: true, value: dom.window.Element },
  Node: { configurable: true, value: dom.window.Node },
  Text: { configurable: true, value: dom.window.Text },
  Event: { configurable: true, value: dom.window.Event },
  PopStateEvent: { configurable: true, value: dom.window.PopStateEvent },
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
  Request: { configurable: true, value: globalThis.Request },
  Response: { configurable: true, value: globalThis.Response },
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

mock.module('@json-render/core', () => ({
  defineCatalog: (_schema: unknown, data: unknown) => ({ data }),
  createStateStore: (initialState: Record<string, unknown> = {}) => {
    let snapshot = { ...initialState };
    const listeners = new Set<() => void>();
    const read = (path: string) => {
      const parts = path.replace(/^\//, '').split('/').filter(Boolean);
      let value: unknown = snapshot;
      for (const part of parts) {
        if (!value || typeof value !== 'object') return undefined;
        value = (value as Record<string, unknown>)[part];
      }
      return value;
    };
    const write = (path: string, value: unknown) => {
      const parts = path.replace(/^\//, '').split('/').filter(Boolean);
      if (parts.length === 0) return;
      const next = { ...snapshot };
      let target: Record<string, unknown> = next;
      for (const part of parts.slice(0, -1)) {
        const current = target[part];
        const child = current && typeof current === 'object' ? { ...(current as Record<string, unknown>) } : {};
        target[part] = child;
        target = child;
      }
      target[parts[parts.length - 1]!] = value;
      snapshot = next;
      for (const listener of listeners) listener();
    };
    return {
      get: read,
      set: write,
      update: (updates: Record<string, unknown>) => {
        for (const [path, value] of Object.entries(updates)) write(path, value);
      },
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  },
}));

mock.module('@json-render/shadcn/catalog', () => ({
  shadcnComponentDefinitions: {
    Stack: { props: {} },
    Heading: { props: {} },
  },
}));

mock.module('@json-render/shadcn', () => {
  function Stack({
    props,
    children,
  }: {
    props?: Record<string, unknown>;
    children?: React.ReactNode;
  }) {
    return React.createElement('div', null, props?.text ? String(props.text) : children);
  }

  function Heading({
    props,
  }: {
    props?: Record<string, unknown>;
  }) {
    return React.createElement('h1', null, String(props?.text ?? ''));
  }

  return {
    shadcnComponents: { Stack, Heading },
  };
});

mock.module('@json-render/react', () => {
  function Provider({ children }: { children?: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }

  function Renderer({
    spec,
    registry,
  }: {
    spec: {
      root: string;
      elements: Record<string, { type: string; props?: Record<string, unknown>; children?: string[] }>;
    };
    registry: Record<string, React.ComponentType<{
      element: { type: string; props?: Record<string, unknown>; children?: string[] };
      children?: React.ReactNode;
    }>>;
  }) {
    const renderElement = (key: string): React.ReactNode => {
      const element = spec.elements[key];
      if (!element) return null;
      if (element.type === '__RNTME_TEST_FORCE_RENDERER_THROW__') {
        const error = new Error('secret token 123');
        error.name = 'SecretToken123 Error';
        throw error;
      }
      const Component = registry[element.type];
      if (!Component) return null;
      const children = element.children?.map((childKey) => renderElement(childKey));
      return React.createElement(Component, { key, element, children });
    }

    return React.createElement(React.Fragment, null, renderElement(spec.root));
  }

  function defineRegistry(
    _catalog: unknown,
    impl: {
      components: Record<string, React.ComponentType<{
        props?: Record<string, unknown>;
        children?: React.ReactNode;
      }>>;
      actions: Record<string, (params?: Record<string, unknown>) => Promise<void>>;
    },
  ) {
    const registry: Record<string, React.ComponentType<{
      element: { type: string; props?: Record<string, unknown> };
      children?: React.ReactNode;
    }>> = {};
    for (const [type, Component] of Object.entries(impl.components)) {
      registry[type] = ({ element, children }) =>
        React.createElement(Component, { props: element.props ?? {}, children });
    }

    return {
      registry,
      handlers: () => impl.actions,
    };
  }

  return {
    schema: {},
    defineRegistry,
    Renderer,
    StateProvider: Provider,
    ActionProvider: Provider,
    VisibilityProvider: Provider,
    ValidationProvider: Provider,
  };
});

afterEach(() => {
  document.body.innerHTML = '';
});
