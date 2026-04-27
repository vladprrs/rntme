export { CLAIMED_EVENTS, CLAIMED_RPCS, SESSION_RPCS } from './capabilities.js';
export { Auth0ManagementAdapter, createAuth0Adapter, createManagementClient } from './adapter.js';
export type { Auth0Adapter, Auth0ManagementOptions } from './adapter.js';
export { createAuth0IdentityModule } from './handlers.js';
export { GrpcStatus, IdentityModuleError, invalidArgument, mapAuth0Error, unimplemented } from './errors.js';
export {
  canonicalRef,
  invitationId,
  mapAuth0Invitation,
  mapAuth0Membership,
  mapAuth0Organization,
  mapAuth0User,
  membershipId,
  metadataToAuth0,
  parseCompositeId,
  toIdentityResolution,
} from './mapping.js';
export { translateAuth0LogEvent } from './events.js';
export { auth0MockConformanceSuite } from './conformance.js';
