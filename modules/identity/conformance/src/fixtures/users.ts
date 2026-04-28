import { proto } from '@rntme/contracts-identity-v1';
import { fixtureRef } from './ref.js';

const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

export const fixtureUsers = {
  ada: id.User.create({
    ref: fixtureRef('user-ada', 'fixt_user_ada'),
    email: 'ada@example.com',
    email_verified: true,
    name: common.Name.create({ given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' }),
    status: id.UserStatus.USER_STATUS_ACTIVE,
  }),
  bob: id.User.create({
    ref: fixtureRef('user-bob', 'fixt_user_bob'),
    email: 'bob@example.com',
    email_verified: false,
    status: id.UserStatus.USER_STATUS_PENDING,
  }),
} as const;
