import { proto } from '@rntme/contracts-identity-v1';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

function ref(canonicalId: string, vendorId: string) {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'identity-fixture',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

export const fixtureInvitations = {
  pendingForAcme: id.Invitation.create({
    ref: ref('inv-1', 'fixt_inv_1'),
    email: 'newcomer@example.com',
    organization_id: 'org-acme',
    inviter_user_id: 'user-ada',
    roles: ['member'],
    status: id.InvitationStatus.INVITATION_STATUS_PENDING,
  }),
} as const;
