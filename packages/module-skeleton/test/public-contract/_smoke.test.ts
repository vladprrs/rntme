import { describe, expect, it } from 'vitest';
import { VERSION, exampleHandlers, ModuleManifestSchema, parseModuleManifest } from '@rntme/module-skeleton';
import type { CommandExecutionContext } from '@rntme/runtime';

describe('@rntme/module-skeleton public contract', () => {
  it('exports the package version marker from the built entrypoint', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('exports an echo handler with the expected shape from the built entrypoint', async () => {
    expect(exampleHandlers).toEqual(
      expect.objectContaining({
        echo: expect.any(Function),
      }),
    );
    const handler = (exampleHandlers as unknown as Record<string, (ctx: CommandExecutionContext, input: unknown) => Promise<unknown>>).echo;
    if (!handler) throw new Error('echo handler missing');
    const out = await handler(
      { correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null } } as unknown as CommandExecutionContext,
      { message: 'hello' },
    );
    expect(out).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          aggregateId: 'echo',
          eventIds: [],
        }),
      }),
    );
  });

  it('exports the ModuleManifest validator from the built entrypoint', () => {
    const manifest = {
      name: 'identity-auth0',
      version: '1.0.0',
      contact: 'platform@example.com',
      grpcServiceName: 'rntme.identity.v1.IdentityModule',
      webhookPath: '/webhooks/auth0',
      secrets: [{ name: 'AUTH0_CLIENT_SECRET', scope: 'tenant' }],
      capabilities: ['identity.users.read'],
    };

    expect(ModuleManifestSchema.safeParse(manifest).success).toBe(true);
    const parsed = parseModuleManifest(manifest);
    expect(parsed).toEqual({ ok: true, value: manifest });
  });
});
