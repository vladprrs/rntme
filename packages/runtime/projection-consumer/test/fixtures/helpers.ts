import type { ApplyPlan, MirrorHandler } from '../../src/types/apply.js';

/**
 * Returns the single mirror handler registered for an eventType. After D5 the
 * plan's handlersByEventType values are `CompiledHandler[]` (mirror + derived);
 * existing entity-mirror tests still expect one mirror handler per eventType,
 * so this helper narrows the type and asserts the count.
 */
export function getMirror(plan: ApplyPlan, eventType: string): MirrorHandler {
  const list = plan.handlersByEventType.get(eventType);
  if (!list || list.length === 0) {
    throw new Error(`no handler registered for eventType "${eventType}"`);
  }
  const mirror = list.find(
    (h): h is MirrorHandler => h.kind === 'insert' || h.kind === 'update',
  );
  if (!mirror) throw new Error(`no mirror handler for eventType "${eventType}"`);
  return mirror;
}
