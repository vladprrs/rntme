import type { PreStep } from '@rntme/bindings';

export type PreStepsResult =
  | { ok: true; systemFields: { pre: Record<string, unknown>; [k: string]: unknown } }
  | { ok: false; httpStatus: number; body: { code: string; message: string; details?: unknown } };

export type { PreStep };
