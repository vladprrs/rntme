import { describe, expect, it } from 'vitest';
import { validateRuntimeConfig } from '../../src/start/runtime-config.js';

describe('validateRuntimeConfig', () => {
  it('rejects an event bus without the required methods', () => {
    const result = validateRuntimeConfig({ bus: {} });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        expect.objectContaining({
          code: 'RUNTIME_CONFIG_EVENT_BUS_INVALID',
          path: 'bus',
        }),
      ],
    });
  });

  it('rejects seedMode when skipSeed makes it unreachable', () => {
    const result = validateRuntimeConfig({ skipSeed: true, seedMode: 'strict' });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        expect.objectContaining({
          code: 'RUNTIME_CONFIG_SEED_MODE_WITH_SKIP_SEED',
          path: 'seedMode',
        }),
      ],
    });
  });

  it('rejects invalid shutdown timeout values', () => {
    const result = validateRuntimeConfig({ shutdownTimeoutMs: 0 });

    expect(result).toMatchObject({
      ok: false,
      errors: [
        expect.objectContaining({
          code: 'RUNTIME_CONFIG_SHUTDOWN_TIMEOUT_INVALID',
          path: 'shutdownTimeoutMs',
        }),
      ],
    });

    expect(validateRuntimeConfig({ shutdownTimeoutMs: 1.5 })).toMatchObject({
      ok: false,
      errors: [
        expect.objectContaining({
          code: 'RUNTIME_CONFIG_SHUTDOWN_TIMEOUT_INVALID',
          path: 'shutdownTimeoutMs',
        }),
      ],
    });
  });

  it('accepts a valid shutdown timeout', () => {
    expect(validateRuntimeConfig({ shutdownTimeoutMs: 50 })).toMatchObject({ ok: true });
  });

  it('accepts valid custom runtime plugin shapes', () => {
    const config = {
      db: { open: () => ({}) },
      bus: {
        producer: () => ({}),
        consumer: () => ({}),
        start: async () => undefined,
        stop: async () => undefined,
      },
      surfaces: [{ mount: () => undefined }],
      actorFromRequest: () => null,
      onReady: () => undefined,
      skipSeed: false,
      operationExecutor: { execute: async () => ({ ok: false, error: { code: 'OPERATION_NOT_FOUND', message: 'x' } }) },
      externalAdapterClient: { call: async () => ({ ok: true, value: null }) },
      artifactDir: '/tmp/artifacts',
      runtimeEnv: { RNTME_AUTH_PROVIDER: undefined, CUSTOM: 'value' },
      shutdownTimeoutMs: 5000,
    };

    expect(validateRuntimeConfig(config)).toMatchObject({ ok: true });
  });
});
