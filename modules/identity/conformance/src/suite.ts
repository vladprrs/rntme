import type { CategoryConformanceSuite } from './types.js';
import { scenarios as AddMembership } from './scenarios/AddMembership.scenarios.js';
import { scenarios as CreateInvitation } from './scenarios/CreateInvitation.scenarios.js';
import { scenarios as CreateOrganization } from './scenarios/CreateOrganization.scenarios.js';
import { scenarios as CreateUser } from './scenarios/CreateUser.scenarios.js';
import { scenarios as DeleteOrganization } from './scenarios/DeleteOrganization.scenarios.js';
import { scenarios as DeleteUser } from './scenarios/DeleteUser.scenarios.js';
import { scenarios as GetInvitation } from './scenarios/GetInvitation.scenarios.js';
import { scenarios as GetMembership } from './scenarios/GetMembership.scenarios.js';
import { scenarios as GetOrganization } from './scenarios/GetOrganization.scenarios.js';
import { scenarios as GetSession } from './scenarios/GetSession.scenarios.js';
import { scenarios as GetUser } from './scenarios/GetUser.scenarios.js';
import { scenarios as IntrospectSession } from './scenarios/IntrospectSession.scenarios.js';
import { scenarios as ListInvitations } from './scenarios/ListInvitations.scenarios.js';
import { scenarios as ListMemberships } from './scenarios/ListMemberships.scenarios.js';
import { scenarios as ListOrganizations } from './scenarios/ListOrganizations.scenarios.js';
import { scenarios as ListSessions } from './scenarios/ListSessions.scenarios.js';
import { scenarios as ListUsers } from './scenarios/ListUsers.scenarios.js';
import { scenarios as RemoveMembership } from './scenarios/RemoveMembership.scenarios.js';
import { scenarios as ResolveIdentity } from './scenarios/ResolveIdentity.scenarios.js';
import { scenarios as RevokeInvitation } from './scenarios/RevokeInvitation.scenarios.js';
import { scenarios as RevokeSession } from './scenarios/RevokeSession.scenarios.js';
import { scenarios as UpdateMembership } from './scenarios/UpdateMembership.scenarios.js';
import { scenarios as UpdateOrganization } from './scenarios/UpdateOrganization.scenarios.js';
import { scenarios as UpdateUser } from './scenarios/UpdateUser.scenarios.js';

export const identityConformanceSuite: CategoryConformanceSuite = {
  category: 'identity',
  contractVersion: 'v1',
  scenariosByRpc: {
    AddMembership,
    CreateInvitation,
    CreateOrganization,
    CreateUser,
    DeleteOrganization,
    DeleteUser,
    GetInvitation,
    GetMembership,
    GetOrganization,
    GetSession,
    GetUser,
    IntrospectSession,
    ListInvitations,
    ListMemberships,
    ListOrganizations,
    ListSessions,
    ListUsers,
    RemoveMembership,
    ResolveIdentity,
    RevokeInvitation,
    RevokeSession,
    UpdateMembership,
    UpdateOrganization,
    UpdateUser,
  },
};

export const suite = identityConformanceSuite;
