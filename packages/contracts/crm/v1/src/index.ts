import * as protoRoot from './proto.gen.js';

export * as proto from './proto.gen.js';
export * from './error-codes.js';
export type { rntme as Rntme } from './proto.gen.js';

const crmv1 = protoRoot.rntme.contracts.crm.v1;
const commonv1 = protoRoot.rntme.contracts.common.v1;

export const Contact = crmv1.Contact;
export const Company = crmv1.Company;
export const Deal = crmv1.Deal;
export const Activity = crmv1.Activity;
export const Note = crmv1.Note;
export const AsyncJob = crmv1.AsyncJob;
export const SyncFullPayload = crmv1.SyncFullPayload;
export const EntityRef = crmv1.EntityRef;
export const Pipeline = crmv1.Pipeline;
export const Stage = crmv1.Stage;
export const Owner = crmv1.Owner;
export const CustomFieldDefinition = crmv1.CustomFieldDefinition;
export const Association = crmv1.Association;
export const CrmModule = crmv1.CrmModule;

export const ContactStatus = crmv1.ContactStatus;
export const CompanyStatus = crmv1.CompanyStatus;
export const DealStatus = crmv1.DealStatus;
export const DealQualification = crmv1.DealQualification;
export const ActivityType = crmv1.ActivityType;
export const ActivityOutcome = crmv1.ActivityOutcome;
export const CustomFieldType = crmv1.CustomFieldType;
export const StageSemantic = crmv1.StageSemantic;
export const AssociationCategory = crmv1.AssociationCategory;
export const AsyncJobType = crmv1.AsyncJobType;
export const AsyncJobStatus = crmv1.AsyncJobStatus;
export const SyncDeltaOp = crmv1.SyncDeltaOp;

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
