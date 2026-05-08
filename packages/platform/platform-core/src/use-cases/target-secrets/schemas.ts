import { z } from 'zod';

export const TARGET_SECRET_SCHEMAS = {
  'auth0-mgmt-api-v1': z
    .object({
      tenantDomain: z.string().min(1),
      mgmtClientId: z.string().min(1),
      mgmtClientSecret: z.string().min(1),
    })
    .strict(),
  'operaton-ui-basic-auth-v1': z
    .object({
      htpasswd: z
        .string()
        .min(1)
        .refine(
          (val) =>
            val
              .split('\n')
              .filter((line) => line.trim().length > 0)
              .every((line) => line.includes(':')),
          { message: 'htpasswd must contain username:hash lines' },
        ),
    })
    .strict(),
  'operaton-admin-user-v1': z
    .object({
      id: z.string().min(1),
      password: z.string().min(1),
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
    })
    .strict(),
  'redpanda-console-basic-auth-v1': z
    .object({
      username: z.string().trim().min(1),
      htpasswdB64: z.string().trim().min(1),
    })
    .strict()
    .superRefine((value, ctx) => {
      let decoded = '';
      try {
        if (!isCanonicalBase64(value.htpasswdB64)) {
          throw new Error('invalid base64');
        }
        decoded = Buffer.from(value.htpasswdB64, 'base64').toString('utf8');
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'htpasswdB64 must be valid base64' });
        return;
      }
      const line = decoded.replace(/\n$/, '');
      if (line.includes('\n') || !line.startsWith(`${value.username}:`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'htpasswdB64 must decode to a single htpasswd line for username',
        });
      }
    }),
} as const;

export type TargetSecretSchemaId = keyof typeof TARGET_SECRET_SCHEMAS;

function isCanonicalBase64(value: string): boolean {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

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
