import type {
  InvitationAccepted,
  InvitationCreated,
  InvitationRevoked,
  MembershipCreated,
  MembershipDeleted,
  OrganizationCreated,
  UserCreated,
  UserDeleted,
  UserEmailVerified,
} from './types.js';
import { mapAuth0Invitation, mapAuth0Membership, mapAuth0Organization, mapAuth0User } from './mapping.js';

export type ClaimedAuth0Event =
  | { type: 'UserCreated'; payload: UserCreated }
  | { type: 'UserDeleted'; payload: UserDeleted }
  | { type: 'UserEmailVerified'; payload: UserEmailVerified }
  | { type: 'OrganizationCreated'; payload: OrganizationCreated }
  | { type: 'MembershipCreated'; payload: MembershipCreated }
  | { type: 'MembershipDeleted'; payload: MembershipDeleted }
  | { type: 'InvitationCreated'; payload: InvitationCreated }
  | { type: 'InvitationAccepted'; payload: InvitationAccepted }
  | { type: 'InvitationRevoked'; payload: InvitationRevoked };

function timestamp(value: unknown): { seconds: number; nanos: number } | undefined {
  if (typeof value !== 'string') return undefined;
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) return undefined;
  return { seconds: Math.floor(millis / 1000), nanos: (millis % 1000) * 1_000_000 };
}

export function translateAuth0LogEvent(log: Record<string, unknown>): ClaimedAuth0Event | null {
  const type = typeof log.type === 'string' ? log.type : '';

  if ((type === 'ss' || type === 'user.created') && typeof log.user_id === 'string') {
    return {
      type: 'UserCreated',
      payload: {
        user: mapAuth0User({
          user_id: log.user_id,
          email: typeof log.user_name === 'string' ? log.user_name : '',
          created_at: typeof log.date === 'string' ? log.date : undefined,
        }),
        trigger: 'auth0-log',
      },
    };
  }

  if (type === 'sv' && typeof log.user_id === 'string') {
    return {
      type: 'UserEmailVerified',
      payload: {
        canonical_id: log.user_id,
        email: typeof log.user_name === 'string' ? log.user_name : '',
        verified_at: timestamp(log.date),
      },
    };
  }

  if (type === 'du' && typeof log.user_id === 'string') {
    return {
      type: 'UserDeleted',
      payload: {
        canonical_id: log.user_id,
        vendor_id: log.user_id,
        hard_delete: true,
        deleted_at: timestamp(log.date),
      },
    };
  }

  if (type === 'organization.created' && typeof log.organization_id === 'string') {
    return {
      type: 'OrganizationCreated',
      payload: {
        organization: mapAuth0Organization({
          id: log.organization_id,
          name: typeof log.organization_name === 'string' ? log.organization_name : '',
        }),
        creator_user_id: typeof log.user_id === 'string' ? log.user_id : '',
      },
    };
  }

  if (type === 'organization.member.added' && typeof log.organization_id === 'string' && typeof log.user_id === 'string') {
    return {
      type: 'MembershipCreated',
      payload: {
        membership: mapAuth0Membership({ organization_id: log.organization_id, user_id: log.user_id }),
        trigger: 'auth0-log',
      },
    };
  }

  if (type === 'organization.member.deleted' && typeof log.organization_id === 'string' && typeof log.user_id === 'string') {
    return {
      type: 'MembershipDeleted',
      payload: {
        canonical_id: `${log.organization_id}:${log.user_id}`,
        user_id: log.user_id,
        organization_id: log.organization_id,
        reason: 'auth0-log',
        deleted_at: timestamp(log.date),
      },
    };
  }

  if (type === 'organization.invitation.created' && typeof log.organization_id === 'string' && typeof log.invitation_id === 'string') {
    return {
      type: 'InvitationCreated',
      payload: {
        invitation: mapAuth0Invitation({
          id: log.invitation_id,
          organization_id: log.organization_id,
          invitee: { email: typeof log.email === 'string' ? log.email : '' },
        }),
        trigger: 'auth0-log',
      },
    };
  }

  if (type === 'organization.invitation.accepted' && typeof log.organization_id === 'string' && typeof log.invitation_id === 'string') {
    return {
      type: 'InvitationAccepted',
      payload: {
        invitation: mapAuth0Invitation({
          id: log.invitation_id,
          organization_id: log.organization_id,
          invitee: { email: typeof log.email === 'string' ? log.email : '' },
          accepted_at: typeof log.date === 'string' ? log.date : undefined,
        }),
        accepted_by_user_id: typeof log.user_id === 'string' ? log.user_id : '',
      },
    };
  }

  if (type === 'organization.invitation.revoked' && typeof log.organization_id === 'string' && typeof log.invitation_id === 'string') {
    return {
      type: 'InvitationRevoked',
      payload: {
        invitation: mapAuth0Invitation({
          id: log.invitation_id,
          organization_id: log.organization_id,
          invitee: { email: typeof log.email === 'string' ? log.email : '' },
          revoked: true,
          revoked_at: typeof log.date === 'string' ? log.date : undefined,
        }),
        revoked_by_user_id: typeof log.user_id === 'string' ? log.user_id : '',
        revoked_at: timestamp(log.date),
      },
    };
  }

  return null;
}
