import * as protoRoot from './proto.gen.js';

export * as proto from './proto.gen.js';
export * from './error-codes.js';
export type { rntme as Rntme } from './proto.gen.js';

const idv1 = protoRoot.rntme.contracts.identity.v1;
const commonv1 = protoRoot.rntme.contracts.common.v1;

export const User = idv1.User;
export const Organization = idv1.Organization;
export const OrganizationMembership = idv1.OrganizationMembership;
export const Invitation = idv1.Invitation;
export const Session = idv1.Session;
export const IdentityResolution = idv1.IdentityResolution;
export const IdentityModule = idv1.IdentityModule;

export const UserStatus = idv1.UserStatus;
export const OrgStatus = idv1.OrgStatus;
export const MembershipStatus = idv1.MembershipStatus;
export const InvitationStatus = idv1.InvitationStatus;
export const SessionStatus = idv1.SessionStatus;
export const TokenType = idv1.TokenType;
export const ResolutionInputType = idv1.ResolutionInputType;

export const CanonicalRef = commonv1.CanonicalRef;
export const CommandContext = commonv1.CommandContext;
export const Name = commonv1.Name;
export const ListRequest = commonv1.ListRequest;
export const Filter = commonv1.Filter;
export const Sort = commonv1.Sort;
export const ListResponseMeta = commonv1.ListResponseMeta;
export const Metadata = commonv1.Metadata;
export const FilterOperator = commonv1.FilterOperator;
export const SortDirection = commonv1.SortDirection;
