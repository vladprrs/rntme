import type { CategoryConformanceSuite } from './types.js';

import { scenarios as GetContact } from './scenarios/GetContact.scenarios.js';
import { scenarios as ListContacts } from './scenarios/ListContacts.scenarios.js';
import { scenarios as CreateContact } from './scenarios/CreateContact.scenarios.js';
import { scenarios as UpdateContact } from './scenarios/UpdateContact.scenarios.js';
import { scenarios as DeleteContact } from './scenarios/DeleteContact.scenarios.js';
import { scenarios as GetCompany } from './scenarios/GetCompany.scenarios.js';
import { scenarios as ListCompanies } from './scenarios/ListCompanies.scenarios.js';
import { scenarios as CreateCompany } from './scenarios/CreateCompany.scenarios.js';
import { scenarios as UpdateCompany } from './scenarios/UpdateCompany.scenarios.js';
import { scenarios as DeleteCompany } from './scenarios/DeleteCompany.scenarios.js';
import { scenarios as GetDeal } from './scenarios/GetDeal.scenarios.js';
import { scenarios as ListDeals } from './scenarios/ListDeals.scenarios.js';
import { scenarios as CreateDeal } from './scenarios/CreateDeal.scenarios.js';
import { scenarios as UpdateDeal } from './scenarios/UpdateDeal.scenarios.js';
import { scenarios as DeleteDeal } from './scenarios/DeleteDeal.scenarios.js';
import { scenarios as GetActivity } from './scenarios/GetActivity.scenarios.js';
import { scenarios as ListActivities } from './scenarios/ListActivities.scenarios.js';
import { scenarios as CreateActivity } from './scenarios/CreateActivity.scenarios.js';
import { scenarios as UpdateActivity } from './scenarios/UpdateActivity.scenarios.js';
import { scenarios as DeleteActivity } from './scenarios/DeleteActivity.scenarios.js';
import { scenarios as GetNote } from './scenarios/GetNote.scenarios.js';
import { scenarios as ListNotes } from './scenarios/ListNotes.scenarios.js';
import { scenarios as CreateNote } from './scenarios/CreateNote.scenarios.js';
import { scenarios as DeleteNote } from './scenarios/DeleteNote.scenarios.js';
import { scenarios as ListPipelines } from './scenarios/ListPipelines.scenarios.js';
import { scenarios as ListCustomFieldDefinitions } from './scenarios/ListCustomFieldDefinitions.scenarios.js';
import { scenarios as ListAssociations } from './scenarios/ListAssociations.scenarios.js';
import { scenarios as CreateAssociation } from './scenarios/CreateAssociation.scenarios.js';
import { scenarios as DeleteAssociation } from './scenarios/DeleteAssociation.scenarios.js';
import { scenarios as SyncDelta } from './scenarios/SyncDelta.scenarios.js';
import { scenarios as SubmitJob } from './scenarios/SubmitJob.scenarios.js';
import { scenarios as GetJob } from './scenarios/GetJob.scenarios.js';
import { scenarios as CancelJob } from './scenarios/CancelJob.scenarios.js';
import { scenarios as ListJobs } from './scenarios/ListJobs.scenarios.js';

export const suite: CategoryConformanceSuite = {
  category: 'crm',
  contract_version: 'v1',
  scenarios: {
    GetContact,
    ListContacts,
    CreateContact,
    UpdateContact,
    DeleteContact,
    GetCompany,
    ListCompanies,
    CreateCompany,
    UpdateCompany,
    DeleteCompany,
    GetDeal,
    ListDeals,
    CreateDeal,
    UpdateDeal,
    DeleteDeal,
    GetActivity,
    ListActivities,
    CreateActivity,
    UpdateActivity,
    DeleteActivity,
    GetNote,
    ListNotes,
    CreateNote,
    DeleteNote,
    ListPipelines,
    ListCustomFieldDefinitions,
    ListAssociations,
    CreateAssociation,
    DeleteAssociation,
    SyncDelta,
    SubmitJob,
    GetJob,
    CancelJob,
    ListJobs,
  },
};
