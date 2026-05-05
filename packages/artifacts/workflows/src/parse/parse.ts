import { WorkflowArtifactSchema } from './schema.js';
import type { WorkflowArtifact } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type Result, type WorkflowError } from '../types/result.js';

export function parseWorkflowArtifact(input: unknown): Result<WorkflowArtifact> {
  let candidate: unknown = input;

  if (typeof input === 'string') {
    try {
      candidate = JSON.parse(input) as unknown;
    } catch (e) {
      return err([
        {
          layer: 'parse',
          code: ERROR_CODES.WORKFLOWS_PARSE_SCHEMA_VIOLATION,
          message: e instanceof Error ? e.message : 'invalid JSON',
        },
      ]);
    }
  }

  const parsed = WorkflowArtifactSchema.safeParse(candidate);
  if (!parsed.success) {
    const errors: WorkflowError[] = parsed.error.issues.map((issue) => {
      const path =
        issue.path.length > 0
          ? issue.path.join('.')
          : 'keys' in issue && Array.isArray(issue.keys) && issue.keys.length > 0
            ? String(issue.keys[0])
            : undefined;
      const base = {
        layer: 'parse' as const,
        code: ERROR_CODES.WORKFLOWS_PARSE_SCHEMA_VIOLATION,
        message: issue.message,
      };
      return path !== undefined ? { ...base, path } : base;
    });
    return err(errors);
  }

  return ok(parsed.data as WorkflowArtifact);
}
