import { afterEach } from 'bun:test';
import { cleanup } from '@testing-library/react';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://storage-s3.test/',
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
  MouseEvent: { configurable: true, value: dom.window.MouseEvent },
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});
