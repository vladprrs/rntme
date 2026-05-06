import {
  materializeAndCompose as materializeAndComposeBlueprint,
  type BlueprintError,
  type ComposedBlueprint,
} from '@rntme/blueprint';
import {
  err,
  ok,
  type CanonicalBundle,
  type PlatformErrorNode,
  type PlatformError,
  type ProjectVersionSummary,
  type Result,
} from '@rntme/platform-core';

export type MaterializeResult = {
  readonly composed: ComposedBlueprint;
  readonly summary: ProjectVersionSummary;
};

export async function materializeAndCompose(
  bundle: CanonicalBundle,
): Promise<Result<MaterializeResult, PlatformError>> {
  const composed = await materializeAndComposeBlueprint(bundle);
  if (!composed.ok) {
    return err([
      {
        code: 'PROJECT_VERSION_BLUEPRINT_INVALID',
        message: composed.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
        stage: 'validation',
        errors: composed.errors.map(blueprintErrorToNode),
      },
    ]);
  }

  return ok({
    composed: composed.value.composed,
    summary: {
      projectName: composed.value.summary.projectName,
      services: [...composed.value.summary.services],
      routes: {
        ui: { ...composed.value.summary.routes.ui },
        http: { ...composed.value.summary.routes.http },
      },
      middleware: { ...composed.value.summary.middleware },
      mounts: [...composed.value.summary.mounts],
    },
  });
}

function blueprintErrorToNode(error: BlueprintError): PlatformErrorNode {
  return {
    code: error.code,
    message: error.message,
    ...(error.path === undefined ? {} : { path: error.path }),
    ...(error.cause === undefined ? {} : { cause: error.cause.map(causeToNode) }),
  };
}

function causeToNode(cause: unknown): PlatformErrorNode {
  if (cause && typeof cause === 'object') {
    const record = cause as Record<string, unknown>;
    return {
      code: typeof record.code === 'string' ? record.code : 'UNKNOWN',
      message: typeof record.message === 'string' ? record.message : JSON.stringify(record),
      ...(typeof record.path === 'string' ? { path: record.path } : {}),
      ...(Array.isArray(record.cause) ? { cause: record.cause.map(causeToNode) } : {}),
    };
  }
  return { code: 'UNKNOWN', message: String(cause) };
}
