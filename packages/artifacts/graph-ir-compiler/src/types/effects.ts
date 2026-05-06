export type Exposure = 'read' | 'action';

export type LocalEmitEffect = Readonly<{
  aggregate: string;
  transition: string;
  eventType: string;
}>;

export type CallEffect = Readonly<{
  target: 'module' | 'service';
  operation: string;
  effect: 'read' | 'action';
  idempotency: 'none' | 'optional' | 'required';
}>;

export type EffectSummary = Readonly<{
  localReads: boolean;
  localEmits: readonly LocalEmitEffect[];
  calls: readonly CallEffect[];
  waits: false;
}>;

export const EMPTY_EFFECT_SUMMARY: EffectSummary = {
  localReads: false,
  localEmits: [],
  calls: [],
  waits: false,
};

export function effectSummaryHasLocalEmit(summary: EffectSummary): boolean {
  return summary.localEmits.length > 0;
}

export function effectSummaryHasAction(summary: EffectSummary): boolean {
  return effectSummaryHasLocalEmit(summary) || summary.calls.some((call) => call.effect === 'action');
}
