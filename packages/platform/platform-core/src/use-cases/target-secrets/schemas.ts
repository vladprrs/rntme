import { z } from 'zod';

export const TARGET_SECRET_SCHEMAS = {
  'auth0-mgmt-api-v1': z
    .object({
      tenantDomain: z.string().min(1),
      mgmtClientId: z.string().min(1),
      mgmtClientSecret: z.string().min(1),
    })
    .strict(),
} as const;

export type TargetSecretSchemaId = keyof typeof TARGET_SECRET_SCHEMAS;

export type TargetSecretParseError = {
  readonly code: 'TARGET_SECRET_SCHEMA_UNKNOWN' | 'TARGET_SECRET_VALIDATION_FAILED';
  readonly message: string;
  readonly path?: readonly (string | number)[];
};

export type TargetSecretParseResult =
  | { ok: true; value: unknown }
  | { ok: false; errors: TargetSecretParseError[] };

export function parseTargetSecret(schemaId: string, value: unknown): TargetSecretParseResult {
  const schema = (TARGET_SECRET_SCHEMAS as Record<string, z.ZodTypeAny | undefined>)[schemaId];
  if (!schema) {
    return {
      ok: false,
      errors: [{ code: 'TARGET_SECRET_SCHEMA_UNKNOWN', message: `unknown target-secret schema id "${schemaId}"` }],
    };
  }
  const r = schema.safeParse(value);
  if (r.success) return { ok: true, value: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => ({
      code: 'TARGET_SECRET_VALIDATION_FAILED' as const,
      message: i.message,
      path: i.path.filter((p): p is string | number => typeof p === 'string' || typeof p === 'number'),
    })),
  };
}
