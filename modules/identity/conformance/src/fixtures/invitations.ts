import { proto } from '@rntme/contracts-identity-v1';
import { fixtureRef } from './ref.js';

const id = proto.rntme.contracts.identity.v1;

export const fixtureInvitations = {
  pendingForAcme: id.Invitation.create({
    ref: fixtureRef('inv-1', 'fixt_inv_1'),
    email: 'newcomer@example.com',
    organization_id: 'org-acme',
    inviter_user_id: 'user-ada',
    roles: ['member'],
    status: id.InvitationStatus.INVITATION_STATUS_PENDING,
  }),
} as const;
