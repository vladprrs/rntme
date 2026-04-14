import type { EmitPlan } from '../types/command.js';
import { CommandExecutionError } from './errors.js';

export function checkTransitionLegal(
  plan: EmitPlan,
  currentState: Record<string, unknown> | null,
  stateField: string,
): void {
  if (plan.isCreation) {
    if (currentState !== null) {
      throw new CommandExecutionError(
        'COMMAND_ILLEGAL_TRANSITION',
        `creation transition "${plan.transition}" cannot run against an existing aggregate`,
        { transition: plan.transition },
      );
    }
    return;
  }
  if (currentState === null) {
    throw new CommandExecutionError(
      'COMMAND_ILLEGAL_TRANSITION',
      `transition "${plan.transition}" requires an existing aggregate`,
      { transition: plan.transition },
    );
  }
  const current = currentState[stateField];
  const allowed = plan.fromStates.filter((s): s is string => s !== null);
  if (!allowed.includes(current as string)) {
    throw new CommandExecutionError(
      'COMMAND_ILLEGAL_TRANSITION',
      `transition "${plan.transition}" illegal from state "${String(current)}"`,
      { transition: plan.transition, current, allowed },
    );
  }
}
