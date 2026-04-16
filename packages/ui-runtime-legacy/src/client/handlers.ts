import type { UiDriver } from './driver.js';

// Every declared action in the artifact becomes a handler keyed by action id.
export function buildHandlers(
  driver: UiDriver,
  currentRoute: () => string,
): Record<string, (params: unknown) => void | Promise<void>> {
  return new Proxy(
    {},
    {
      get(_t, actionId: string) {
        return () => driver.invokeAction(currentRoute(), actionId);
      },
    },
  ) as Record<string, (params: unknown) => void | Promise<void>>;
}
