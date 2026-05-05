import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EventTypeSpec } from '@rntme/pdm';
import {
  parseWorkflowArtifact,
  validateWorkflows,
  type ValidatedWorkflows,
  type WorkflowBindingResolution,
  type WorkflowCrossRefContext,
  type WorkflowEventRef,
} from '@rntme/workflows';
import type {
  RoutedBindingEntry,
  ValidatedServiceMember,
} from '../types/artifact.js';
import { ERROR_CODES, err, ok, type Result } from '../types/result.js';

export function loadProjectWorkflows(input: {
  readonly rootDir: string;
  readonly services: Readonly<Record<string, ValidatedServiceMember>>;
  readonly bindingRegistry: Readonly<Record<string, RoutedBindingEntry>>;
}): Result<ValidatedWorkflows | null> {
  const relPath = 'workflows/workflows.json';
  const absPath = join(input.rootDir, relPath);
  if (!existsSync(absPath)) return ok(null);

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(absPath, 'utf8'));
  } catch (cause) {
    return err([
      {
        layer: 'composition',
        code: ERROR_CODES.BLUEPRINT_WORKFLOWS_INVALID,
        message: 'failed to read workflows/workflows.json',
        path: relPath,
        cause: [cause instanceof Error ? cause.message : String(cause)],
      },
    ]);
  }

  const parsed = parseWorkflowArtifact(raw);
  if (!parsed.ok) return workflowErr(relPath, parsed.errors);

  const ctx = buildWorkflowContext(
    input.rootDir,
    input.services,
    input.bindingRegistry,
  );
  const validated = validateWorkflows(parsed.value, ctx);
  if (!validated.ok) return workflowErr(relPath, validated.errors);

  return ok(validated.value);
}

function buildWorkflowContext(
  rootDir: string,
  services: Readonly<Record<string, ValidatedServiceMember>>,
  bindingRegistry: Readonly<Record<string, RoutedBindingEntry>>,
): WorkflowCrossRefContext {
  const events = new Map<string, EventTypeSpec>();
  for (const [serviceSlug, service] of Object.entries(services)) {
    for (const event of service.eventTypes) {
      events.set(
        eventKey(serviceSlug, event.aggregateType, event.eventType),
        event,
      );
    }
  }

  return {
    services: Object.keys(services),
    fileExists: (relativePath) =>
      existsSync(join(rootDir, 'workflows', relativePath)),
    resolveEvent: (ref: WorkflowEventRef) =>
      events.has(eventKey(ref.service, ref.aggregateType, ref.eventType))
        ? {
            service: ref.service,
            aggregateType: ref.aggregateType,
            eventType: ref.eventType,
          }
        : null,
    resolveBindingRef: (ref: string): WorkflowBindingResolution | null => {
      const entry = bindingRegistry[ref];
      if (entry === undefined) return null;
      const resolved: WorkflowBindingResolution = {
        service: entry.service,
        bindingId: entry.bindingId,
        qualifiedId: entry.qualifiedId,
        method: entry.method,
        path: entry.path,
      };
      return entry.kind === undefined
        ? resolved
        : { ...resolved, kind: entry.kind };
    },
  };
}

function eventKey(
  service: string,
  aggregateType: string,
  eventType: string,
): string {
  return `${service}:${aggregateType}:${eventType}`;
}

function workflowErr<T>(path: string, cause: readonly unknown[]): Result<T> {
  return err([
    {
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_WORKFLOWS_INVALID,
      message: 'workflow artifact failed validation',
      path,
      cause: [...cause],
    },
  ]);
}
