import { readFile as fsReadFile } from 'node:fs/promises';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';
import { cliError, type CliError } from '../errors/codes.js';
import { TargetFileSchema } from './target-schema.js';
import type { LoadedTarget, LoadTargetDeps } from './types.js';

export async function loadTargetFile(
  path: string,
  slug: string,
  deps: LoadTargetDeps = {},
): Promise<Result<LoadedTarget, CliError>> {
  const reader = deps.readFile ?? ((p: string) => fsReadFile(p, 'utf8'));
  let raw: string;
  try {
    raw = await reader(path);
  } catch (cause) {
    return err(
      cliError(
        'CLI_DEPLOY_TARGET_FILE_INVALID',
        `cannot read target file ${path}: ${String(cause)}`,
        undefined,
        cause,
      ),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    return err(
      cliError('CLI_DEPLOY_TARGET_FILE_INVALID', `target file ${path} is not valid JSON`, undefined, cause),
    );
  }

  const validated = TargetFileSchema.safeParse(parsed);
  if (!validated.success) {
    return err(
      cliError(
        'CLI_DEPLOY_TARGET_FILE_INVALID',
        `target file ${path} failed schema validation: ${validated.error.message}`,
        undefined,
        validated.error,
      ),
    );
  }

  const file = validated.data;
  if (file.kind === 'dokploy') {
    const auth = buildAuthSection(file.auth);
    const workflows = buildWorkflowsSection(file.workflows);
    return ok({
      target: {
        id: `direct-${slug}`,
        slug,
        kind: 'dokploy',
        displayName: file.displayName,
        dokployUrl: file.config.dokployUrl,
        publicBaseUrl: file.publicBaseUrl ?? null,
        dokployProjectId: file.config.dokployProjectId ?? null,
        dokployProjectName: file.config.dokployProjectName ?? null,
        allowCreateProject: file.config.allowCreateProject ?? false,
        eventBus: file.eventBus ?? { kind: 'kafka', mode: 'external', brokers: ['localhost:9092'] },
        modules: {},
        workflows,
        storage: { mode: 'external' },
        auth,
        policyValues: {},
        manualAccess: {},
      } as never,
      secretRefs: { apiToken: file.secrets.apiToken, extras: file.secrets.extras ?? {} },
    });
  }
  // unreachable — discriminated union exhausts kinds, but TypeScript needs the catch-all.
  return err(cliError('CLI_DEPLOY_TARGET_FILE_INVALID', 'unknown target kind'));
}

type FileAuth = NonNullable<ReturnType<typeof TargetFileSchema.parse>['auth']>;

function buildAuthSection(input: FileAuth | undefined): Record<string, unknown> {
  if (input?.auth0 === undefined) return {};
  const auth0Input = input.auth0;
  // `DeployTargetForBuild.auth.auth0.clientId` is typed as required `string`,
  // but the platform blueprint sources AUTH0_SPA_CLIENT_ID from the identity
  // provisioner output (`provision.identity.spaClient.id`), not from target.auth.
  // Default to '' so the field is structurally present without leaking a fake id
  // — vars resolution only reads the optional domain/audience/redirectUri paths
  // that the blueprint actually declares.
  const auth0: Record<string, unknown> = { clientId: auth0Input.clientId ?? '' };
  if (auth0Input.domain !== undefined) auth0.domain = auth0Input.domain;
  if (auth0Input.audience !== undefined) auth0.audience = auth0Input.audience;
  if (auth0Input.redirectUri !== undefined) auth0.redirectUri = auth0Input.redirectUri;
  return { auth0 };
}

type FileWorkflows = NonNullable<ReturnType<typeof TargetFileSchema.parse>['workflows']>;

function buildWorkflowsSection(input: FileWorkflows | undefined): Record<string, unknown> | null {
  if (input === undefined) return null;
  const engine: Record<string, unknown> = {
    kind: input.engine.kind,
    mode: input.engine.mode,
    image: input.engine.image,
  };
  if (input.engine.adminUserSecretRef !== undefined) {
    engine.adminUserSecretRef = input.engine.adminUserSecretRef;
  }
  const out: Record<string, unknown> = {
    engine,
    worker: { image: input.worker.image },
  };
  if (input.operatonUi !== undefined) out.operatonUi = input.operatonUi;
  return out;
}
