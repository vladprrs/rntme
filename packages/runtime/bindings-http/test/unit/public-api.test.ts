import { describe, it, expect, expectTypeOf } from 'bun:test';
import * as api from '../../src/index.js';
import type {
  BindingsRouterOptions,
  RuntimeGraphSpec,
  ValidatedPdm,
  ValidatedQsm,
  OperationExecutor,
} from '../../src/index.js';

describe('public API surface', () => {
  it('exports createBindingsRouter', () => {
    expect(typeof api.createBindingsRouter).toBe('function');
  });
  it('exports BindingsRuntimeError', () => {
    expect(typeof api.BindingsRuntimeError).toBe('function');
  });
  it('exports startup error helpers', () => {
    expect(api.BINDINGS_HTTP_STARTUP_ERROR_CODES.MISSING_RUNTIME_DEPENDENCY).toBe(
      'BINDINGS_HTTP_STARTUP_MISSING_RUNTIME_DEPENDENCY',
    );
    expect(typeof api.missingRuntimeDependencyError).toBe('function');
  });
  it('exports commandErrorBody', () => {
    expect(typeof api.commandErrorBody).toBe('function');
  });
  it('exports commandErrorStatus', () => {
    expect(typeof api.commandErrorStatus).toBe('function');
  });
  it('exports buildDefaultGraphIrOperationMap', () => {
    expect(typeof api.buildDefaultGraphIrOperationMap).toBe('function');
  });
  it('exports operation executor contract types', () => {
    expectTypeOf<OperationExecutor>().toBeObject();
  });
  it('exports correlationMiddleware', () => {
    expect(typeof api.correlationMiddleware).toBe('function');
  });
  it('exports VERSION', () => {
    expect(typeof api.VERSION).toBe('string');
  });
  it('types router graph inputs as owner-validated artifacts', () => {
    expectTypeOf<BindingsRouterOptions['graphSpec']>().toEqualTypeOf<RuntimeGraphSpec>();
    expectTypeOf<BindingsRouterOptions['pdm']>().toEqualTypeOf<ValidatedPdm>();
    expectTypeOf<BindingsRouterOptions['qsm']>().toEqualTypeOf<ValidatedQsm>();
  });
});
