import { describe, it, expect } from 'bun:test';
import { CommandExecutionError } from '@rntme/graph-ir-compiler';
import { commandErrorBody, commandErrorStatus } from '../../src/errors.js';

describe('commandErrorStatus', () => {
  it('maps COMMAND_CONCURRENCY_CONFLICT → 409', () => {
    const err = new CommandExecutionError('COMMAND_CONCURRENCY_CONFLICT', 'x');
    expect(commandErrorStatus(err)).toBe(409);
  });

  it('maps COMMAND_GUARD_REJECTED → 422', () => {
    const err = new CommandExecutionError('COMMAND_GUARD_REJECTED', 'x');
    expect(commandErrorStatus(err)).toBe(422);
  });

  it('maps COMMAND_ILLEGAL_TRANSITION → 422', () => {
    const err = new CommandExecutionError('COMMAND_ILLEGAL_TRANSITION', 'x');
    expect(commandErrorStatus(err)).toBe(422);
  });
});

describe('commandErrorBody', () => {
  it('copies code and message from CommandExecutionError', () => {
    const err = new CommandExecutionError(
      'COMMAND_ILLEGAL_TRANSITION',
      'issue cannot be assigned from closed',
    );
    expect(commandErrorBody(err)).toEqual({
      code: 'COMMAND_ILLEGAL_TRANSITION',
      message: 'issue cannot be assigned from closed',
    });
  });

  it('includes detail when present', () => {
    const err = new CommandExecutionError('COMMAND_GUARD_REJECTED', 'over capacity', {
      nodeId: 'guardCapacity',
    });
    expect(commandErrorBody(err)).toEqual({
      code: 'COMMAND_GUARD_REJECTED',
      message: 'over capacity',
      details: { nodeId: 'guardCapacity' },
    });
  });
});
