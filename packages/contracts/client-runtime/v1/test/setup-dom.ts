import { Window } from 'happy-dom';

const globalScope = globalThis as typeof globalThis & {
  document?: unknown;
};

if (!globalScope.document) {
  const window = new Window({ url: 'https://example.test/' });

  Object.defineProperties(globalThis, {
    window: { value: window, configurable: true },
    document: { value: window.document, configurable: true },
    navigator: { value: window.navigator, configurable: true },
    HTMLElement: { value: window.HTMLElement, configurable: true },
    Node: { value: window.Node, configurable: true },
    Event: { value: window.Event, configurable: true },
  });
}
