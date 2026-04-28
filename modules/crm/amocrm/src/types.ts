import type { Rntme } from '@rntme/contracts-crm-v1';

export type CanonicalRef = Rntme.contracts.common.v1.ICanonicalRef;
export type ListResponseMeta = Rntme.contracts.common.v1.IListResponseMeta;
export type Metadata = Rntme.contracts.common.v1.IMetadata;
export type Name = Rntme.contracts.common.v1.IName;
export type CommandContext = Rntme.contracts.common.v1.ICommandContext;

export type Contact = Rntme.contracts.crm.v1.IContact;
export type Company = Rntme.contracts.crm.v1.ICompany;
export type Deal = Rntme.contracts.crm.v1.IDeal;
export type Activity = Rntme.contracts.crm.v1.IActivity;
export type Note = Rntme.contracts.crm.v1.INote;
export type Pipeline = Rntme.contracts.crm.v1.IPipeline;
export type Stage = Rntme.contracts.crm.v1.IStage;
export type Owner = Rntme.contracts.crm.v1.IOwner;
export type CustomFieldDefinition = Rntme.contracts.crm.v1.ICustomFieldDefinition;
export type Association = Rntme.contracts.crm.v1.IAssociation;
export type AsyncJob = Rntme.contracts.crm.v1.IAsyncJob;
export type EntityRef = Rntme.contracts.crm.v1.IEntityRef;

export type ContactStatus = Rntme.contracts.crm.v1.ContactStatus;
export type CompanyStatus = Rntme.contracts.crm.v1.CompanyStatus;
export type DealStatus = Rntme.contracts.crm.v1.DealStatus;
export type DealQualification = Rntme.contracts.crm.v1.DealQualification;
export type ActivityType = Rntme.contracts.crm.v1.ActivityType;
export type ActivityOutcome = Rntme.contracts.crm.v1.ActivityOutcome;
export type CustomFieldType = Rntme.contracts.crm.v1.CustomFieldType;
export type StageSemantic = Rntme.contracts.crm.v1.StageSemantic;
export type AssociationCategory = Rntme.contracts.crm.v1.AssociationCategory;
export type AsyncJobType = Rntme.contracts.crm.v1.AsyncJobType;
export type AsyncJobStatus = Rntme.contracts.crm.v1.AsyncJobStatus;
export type SyncDeltaOp = Rntme.contracts.crm.v1.SyncDeltaOp;

export type GetContactRequest = Rntme.contracts.crm.v1.IGetContactRequest;
export type ListContactsRequest = Rntme.contracts.crm.v1.IListContactsRequest;
export type CreateContactRequest = Rntme.contracts.crm.v1.ICreateContactRequest;
export type UpdateContactRequest = Rntme.contracts.crm.v1.IUpdateContactRequest;
export type DeleteContactRequest = Rntme.contracts.crm.v1.IDeleteContactRequest;

export type GetCompanyRequest = Rntme.contracts.crm.v1.IGetCompanyRequest;
export type ListCompaniesRequest = Rntme.contracts.crm.v1.IListCompaniesRequest;
export type CreateCompanyRequest = Rntme.contracts.crm.v1.ICreateCompanyRequest;
export type UpdateCompanyRequest = Rntme.contracts.crm.v1.IUpdateCompanyRequest;
export type DeleteCompanyRequest = Rntme.contracts.crm.v1.IDeleteCompanyRequest;

export type GetDealRequest = Rntme.contracts.crm.v1.IGetDealRequest;
export type ListDealsRequest = Rntme.contracts.crm.v1.IListDealsRequest;
export type CreateDealRequest = Rntme.contracts.crm.v1.ICreateDealRequest;
export type UpdateDealRequest = Rntme.contracts.crm.v1.IUpdateDealRequest;
export type DeleteDealRequest = Rntme.contracts.crm.v1.IDeleteDealRequest;

export type GetActivityRequest = Rntme.contracts.crm.v1.IGetActivityRequest;
export type ListActivitiesRequest = Rntme.contracts.crm.v1.IListActivitiesRequest;
export type CreateActivityRequest = Rntme.contracts.crm.v1.ICreateActivityRequest;
export type UpdateActivityRequest = Rntme.contracts.crm.v1.IUpdateActivityRequest;
export type DeleteActivityRequest = Rntme.contracts.crm.v1.IDeleteActivityRequest;

export type GetNoteRequest = Rntme.contracts.crm.v1.IGetNoteRequest;
export type ListNotesRequest = Rntme.contracts.crm.v1.IListNotesRequest;
export type CreateNoteRequest = Rntme.contracts.crm.v1.ICreateNoteRequest;
export type DeleteNoteRequest = Rntme.contracts.crm.v1.IDeleteNoteRequest;

export type ListPipelinesRequest = Rntme.contracts.crm.v1.IListPipelinesRequest;
export type ListCustomFieldDefinitionsRequest = Rntme.contracts.crm.v1.IListCustomFieldDefinitionsRequest;
export type CreateAssociationRequest = Rntme.contracts.crm.v1.ICreateAssociationRequest;
export type DeleteAssociationRequest = Rntme.contracts.crm.v1.IDeleteAssociationRequest;
export type ListAssociationsRequest = Rntme.contracts.crm.v1.IListAssociationsRequest;

export type SyncDeltaRequest = Rntme.contracts.crm.v1.ISyncDeltaRequest;
export type SubmitJobRequest = Rntme.contracts.crm.v1.ISubmitJobRequest;
export type GetJobRequest = Rntme.contracts.crm.v1.IGetJobRequest;
export type CancelJobRequest = Rntme.contracts.crm.v1.ICancelJobRequest;
export type ListJobsRequest = Rntme.contracts.crm.v1.IListJobsRequest;

export type JsonObject = Record<string, unknown>;

export interface Paginated<T> {
  data?: T[];
  totalCount?: number | undefined;
  total_count?: number | undefined;
}

export interface CloudEvent<TData = unknown> {
  specversion: '1.0';
  id: string;
  source: string;
  type: string;
  subject?: string;
  time: string;
  datacontenttype: 'application/json';
  data: TData;
}

export interface WebhookDedupeStore {
  seen(id: string): boolean | Promise<boolean>;
  markSeen(id: string): void | Promise<void>;
}
