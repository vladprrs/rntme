import { isOk } from '@rntme/platform-core';
import type {
  ApiTokenProvider,
  AuthSubject,
  OrganizationRepo,
  PlatformError,
} from '@rntme/platform-core';

export type ResolveAuthorizedOrgInput = {
  readonly provider: ApiTokenProvider;
  readonly organizations: OrganizationRepo;
  readonly authorization: string;
  /** Caller-supplied id, slug, or WorkOS org id. */
  readonly organizationId: string;
};

export type ResolveAuthorizedOrgResult =
  | { readonly status: 'ok'; readonly subject: AuthSubject; readonly orgId: string }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

/**
 * Authenticates the request and verifies that the supplied `organizationId`
 * resolves to the same platform organization as the authenticated subject.
 * Accepts platform internal id, slug, or WorkOS organization id.
 */
export async function resolveAuthorizedOrg(
  input: ResolveAuthorizedOrgInput,
): Promise<ResolveAuthorizedOrgResult> {
  const auth = await input.provider.authenticate({
    authorizationHeader: input.authorization,
    cookieHeader: undefined,
  });
  if (!isOk(auth)) return { status: 'error', errors: auth.errors };
  const subject = auth.value;

  const byId = await input.organizations.findById(input.organizationId);
  if (!isOk(byId)) return { status: 'error', errors: byId.errors };
  let resolved = byId.value;
  if (!resolved) {
    const bySlug = await input.organizations.findBySlug(input.organizationId);
    if (!isOk(bySlug)) return { status: 'error', errors: bySlug.errors };
    resolved = bySlug.value;
  }
  if (!resolved) {
    const byWorkos = await input.organizations.findByWorkosId(input.organizationId);
    if (!isOk(byWorkos)) return { status: 'error', errors: byWorkos.errors };
    resolved = byWorkos.value;
  }
  if (!resolved) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_TENANCY_ORG_NOT_FOUND', message: input.organizationId }],
    };
  }
  if (resolved.id !== subject.org.id) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_AUTH_FORBIDDEN', message: 'organization does not match subject' }],
    };
  }
  return { status: 'ok', subject, orgId: resolved.id };
}
