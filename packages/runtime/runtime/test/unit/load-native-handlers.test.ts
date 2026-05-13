import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadNativeHandlers } from '../../src/bin/runtime.js';

function makeDir(): string {
  return mkdtempSync(join(tmpdir(), 'rntme-native-handlers-'));
}

function writeOpsAndHandler(
  dir: string,
  opsJson: unknown,
  handlerFiles: Record<string, string> = {},
): void {
  writeFileSync(join(dir, 'operations.json'), JSON.stringify(opsJson, null, 2));
  const handlersDir = join(dir, 'handlers');
  mkdirSync(handlersDir, { recursive: true });
  for (const [filename, source] of Object.entries(handlerFiles)) {
    writeFileSync(join(handlersDir, filename), source);
  }
}

describe('loadNativeHandlers', () => {
  it('returns an empty map when operations.json is absent', async () => {
    const dir = makeDir();
    const handlers = await loadNativeHandlers(dir);
    expect(handlers).toEqual({});
  });

  it('imports a single native handler and exposes it by operation name', async () => {
    const dir = makeDir();
    writeOpsAndHandler(
      dir,
      {
        version: '1',
        operations: {
          IntrospectToken: {
            handler: {
              kind: 'native',
              entry: './handlers/introspect-token.ts',
              export: 'introspectTokenHandler',
            },
          },
        },
      },
      {
        'introspect-token.ts': `export async function introspectTokenHandler(inputs) {
  return { status: 'active', echoed: inputs };
}
`,
      },
    );

    const handlers = await loadNativeHandlers(dir);
    const handler = handlers.IntrospectToken;
    expect(typeof handler).toBe('function');
    const result = await handler!({ bearerToken: 'tok' }, {
      correlation: { commandId: 'c', correlationId: 'k', traceparent: null },
    } as never);
    expect(result).toEqual({ status: 'active', echoed: { bearerToken: 'tok' } });
  });

  it('skips operations whose handler.kind is not native', async () => {
    const dir = makeDir();
    writeOpsAndHandler(dir, {
      version: '1',
      operations: {
        ListTokens: {
          handler: { kind: 'graph', entry: 'irrelevant', export: 'irrelevant' },
        },
      },
    });

    const handlers = await loadNativeHandlers(dir);
    expect(handlers).toEqual({});
  });

  it('throws when the named export is missing from the handler module', async () => {
    const dir = makeDir();
    writeOpsAndHandler(
      dir,
      {
        version: '1',
        operations: {
          IntrospectToken: {
            handler: {
              kind: 'native',
              entry: './handlers/introspect-token.ts',
              export: 'introspectTokenHandler',
            },
          },
        },
      },
      {
        'introspect-token.ts': `export async function notTheRightExport() { return null; }\n`,
      },
    );

    await expect(loadNativeHandlers(dir)).rejects.toThrow(
      /RUNTIME_NATIVE_HANDLER_EXPORT_MISSING:IntrospectToken/,
    );
  });
});
