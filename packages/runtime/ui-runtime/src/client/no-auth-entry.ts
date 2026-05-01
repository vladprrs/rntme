import { hydrateApp } from './entry.js';

void hydrateApp({ rootSelector: '#root' }).catch((err: unknown) => {
  console.error('[rntme ui-runtime]', err);
  const el = document.querySelector('#root');
  if (el) el.textContent = err instanceof Error ? err.message : String(err);
});
