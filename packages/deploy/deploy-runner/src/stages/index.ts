import { compose } from './compose.js';
import { provision } from './provision.js';
import { plan } from './plan.js';
import { render } from './render.js';
import { apply } from './apply.js';
import { verify } from './verify.js';

export const stages = { compose, provision, plan, render, apply, verify } as const;

export { compose, provision, plan, render, apply, verify };
export { StageError } from './compose.js';
export type * from './types.js';
