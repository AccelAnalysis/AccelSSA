-- AccelSSA Category 11 reference PostgreSQL schema.
-- This is a persistence contract for convergence with the shared platform adapter;
-- it is not an assertion that Category 11 owns the platform database choice.

create table if not exists decision_documents (
  id text primary key,
  tenant_id text not null,
  client_id text,
  project_id text not null,
  candidate_id text,
  property_id text,
  category text not null,
  title text not null,
  description text,
  source_organization_id text,
  source_contact_id text,
  confidentiality text not null,
  visibility text not null,
  current_version_id text,
  status text not null default 'ACTIVE',
  created_by text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (visibility in ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  check (confidentiality in ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED')),
  check (status in ('ACTIVE','SUPERSEDED','ARCHIVED'))
);

create index if not exists decision_documents_project_idx on decision_documents (tenant_id, project_id);
create index if not exists decision_documents_candidate_idx on decision_documents (tenant_id, project_id, candidate_id);

create table if not exists decision_document_versions (
  id text primary key,
  document_id text not null references decision_documents(id),
  version_number integer not null check (version_number > 0),
  storage_object_id text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  checksum text not null,
  effective_date date,
  source_date date,
  uploaded_by text not null,
  uploaded_at timestamptz not null,
  supersedes_version_id text references decision_document_versions(id),
  unique (document_id, version_number)
);

alter table decision_documents
  drop constraint if exists decision_documents_current_version_fk;
alter table decision_documents
  add constraint decision_documents_current_version_fk foreign key (current_version_id)
  references decision_document_versions(id) deferrable initially deferred;

create table if not exists decision_document_links (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  document_id text not null references decision_documents(id),
  target_type text not null,
  target_id text not null,
  relationship_type text not null,
  created_by text not null,
  created_at timestamptz not null,
  check (relationship_type in ('ATTACHMENT','SOURCE','REFERENCE','OUTPUT'))
);

create index if not exists decision_document_links_target_idx
  on decision_document_links (tenant_id, project_id, target_type, target_id);
create index if not exists decision_document_links_document_idx
  on decision_document_links (tenant_id, project_id, document_id);

create table if not exists decision_evidence (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  title text not null,
  description text,
  source_type text not null,
  source_id text,
  document_version_id text references decision_document_versions(id),
  metric_observation_id text,
  external_reference_id text,
  observation_date date,
  effective_date date,
  confidence text,
  confidentiality text not null,
  visibility text not null,
  created_by text not null,
  created_at timestamptz not null,
  check (source_type in ('DOCUMENT_VERSION','METRIC_OBSERVATION','CLIENT_RESPONSE','CONSULTANT_ASSERTION','EXTERNAL_REFERENCE')),
  check (confidence is null or confidence in ('LOW','MEDIUM','HIGH')),
  check (visibility in ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  check (confidentiality in ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED'))
);

create index if not exists decision_evidence_project_idx on decision_evidence (tenant_id, project_id);

create table if not exists decision_evidence_links (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  evidence_id text not null references decision_evidence(id),
  target_type text not null,
  target_id text not null,
  relationship text not null,
  note text,
  created_by text not null,
  created_at timestamptz not null,
  check (relationship in ('SUPPORTS','CONTRADICTS','QUALIFIES','SUPERSEDES','VERIFIES'))
);

create index if not exists decision_evidence_links_target_idx
  on decision_evidence_links (tenant_id, project_id, target_type, target_id);
create index if not exists decision_evidence_links_evidence_idx
  on decision_evidence_links (tenant_id, project_id, evidence_id);

create table if not exists decision_dependencies (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  from_type text not null,
  from_id text not null,
  to_type text not null,
  to_id text not null,
  relation text not null,
  created_at timestamptz not null,
  check (relation in ('SUPPORTS','DERIVES_FROM','EVALUATES','QUALIFIES','CONTRADICTS','SUPERSEDES','CONDITIONS'))
);

create index if not exists decision_dependencies_from_idx
  on decision_dependencies (tenant_id, project_id, from_type, from_id);
create index if not exists decision_dependencies_to_idx
  on decision_dependencies (tenant_id, project_id, to_type, to_id);

create table if not exists decision_snapshots (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  references_json jsonb not null,
  created_by text not null,
  created_at timestamptz not null
);

create index if not exists decision_snapshots_project_idx on decision_snapshots (tenant_id, project_id, created_at desc);

create table if not exists recommendations (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  version integer not null check (version > 0),
  status text not null,
  title text not null,
  executive_summary text not null,
  rationale text not null,
  next_steps text,
  decision_snapshot_id text not null references decision_snapshots(id),
  supersedes_recommendation_id text references recommendations(id),
  visibility text not null,
  confidentiality text not null,
  author_id text not null,
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null,
  finalized_at timestamptz,
  check (status in ('DRAFT','INTERNAL_REVIEW','CLIENT_REVIEW','FINAL')),
  check (visibility in ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  check (confidentiality in ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED'))
);

create unique index if not exists recommendations_project_version_idx on recommendations (tenant_id, project_id, version);

create table if not exists recommendation_candidates (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  recommendation_id text not null references recommendations(id),
  candidate_id text not null,
  disposition text not null,
  rank integer,
  rationale text not null,
  conditions_summary text,
  visibility text not null,
  confidentiality text not null,
  check (disposition in ('PREFERRED','ALTERNATIVE','CONDITIONAL','NOT_RECOMMENDED')),
  check (rank is null or rank > 0),
  check (visibility in ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  check (confidentiality in ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED')),
  unique (recommendation_id, candidate_id)
);

create table if not exists recommendation_sections (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  recommendation_id text not null references recommendations(id),
  section_type text not null,
  title text not null,
  section_order integer not null check (section_order >= 0),
  content_mode text not null,
  narrative text not null,
  source_snapshot_id text references decision_snapshots(id),
  visibility text not null,
  confidentiality text not null,
  check (content_mode in ('GENERATED','MANUAL','HYBRID')),
  check (visibility in ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  check (confidentiality in ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED'))
);

create index if not exists recommendation_sections_order_idx
  on recommendation_sections (tenant_id, project_id, recommendation_id, section_order);

create table if not exists recommendation_conditions (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  recommendation_id text not null references recommendations(id),
  description text not null,
  target_type text,
  target_id text,
  owner_id text,
  due_date date,
  status text not null,
  resolution_evidence_id text references decision_evidence(id),
  visibility text not null,
  confidentiality text not null,
  created_at timestamptz not null,
  resolved_at timestamptz,
  check (status in ('OPEN','SATISFIED','WAIVED','FAILED')),
  check (visibility in ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  check (confidentiality in ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED'))
);

create table if not exists project_questions (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  candidate_id text,
  question text not null,
  requested_from_user_id text,
  requested_from_role text,
  visibility text not null,
  confidentiality text not null,
  status text not null,
  due_date date,
  answer text,
  answered_by text,
  answered_at timestamptz,
  check (status in ('OPEN','ANSWERED','ACCEPTED','CLOSED')),
  check (visibility in ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  check (confidentiality in ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED'))
);

create table if not exists decision_acknowledgements (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  recommendation_id text not null references recommendations(id),
  recommendation_version integer not null,
  client_user_id text not null,
  action text not null,
  comment text,
  created_at timestamptz not null,
  check (action in ('ACKNOWLEDGED','APPROVED','REJECTED','REQUESTED_REVISION'))
);

create index if not exists decision_acknowledgements_recommendation_idx
  on decision_acknowledgements (tenant_id, project_id, recommendation_id, created_at);

create table if not exists report_templates (
  id text primary key,
  tenant_id text not null,
  name text not null,
  description text,
  status text not null default 'ACTIVE',
  current_version_id text,
  created_by text not null,
  created_at timestamptz not null,
  check (status in ('ACTIVE','ARCHIVED'))
);

create index if not exists report_templates_tenant_idx on report_templates (tenant_id, status);

create table if not exists report_template_versions (
  id text primary key,
  template_id text not null references report_templates(id),
  version_number integer not null check (version_number > 0),
  definition_json jsonb not null,
  branding_json jsonb not null,
  created_by text not null,
  created_at timestamptz not null,
  unique (template_id, version_number)
);

alter table report_templates
  drop constraint if exists report_templates_current_version_fk;
alter table report_templates
  add constraint report_templates_current_version_fk foreign key (current_version_id)
  references report_template_versions(id) deferrable initially deferred;

create table if not exists deliverables (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  type text not null,
  title text not null,
  status text not null,
  template_id text not null,
  template_version_id text not null,
  source_snapshot_id text not null references decision_snapshots(id),
  visibility text not null,
  confidentiality text not null,
  current_version_id text,
  created_by text not null,
  created_at timestamptz not null,
  check (status in ('DRAFT','GENERATING','READY_FOR_REVIEW','APPROVED','PUBLISHED','GENERATION_FAILED','SUPERSEDED','WITHDRAWN')),
  check (visibility in ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  check (confidentiality in ('PUBLIC','INTERNAL','CONFIDENTIAL','CLIENT_CONFIDENTIAL','HIGHLY_RESTRICTED'))
);

create index if not exists deliverables_project_idx on deliverables (tenant_id, project_id, type, status);

create table if not exists deliverable_versions (
  id text primary key,
  deliverable_id text not null references deliverables(id),
  version_number integer not null check (version_number > 0),
  source_snapshot_id text not null references decision_snapshots(id),
  template_version_id text not null,
  generated_by text not null,
  generated_at timestamptz not null,
  format text not null,
  storage_object_id text not null,
  checksum text not null,
  check (format in ('PDF','PPTX','XLSX','ZIP','PNG','JSON')),
  unique (deliverable_id, version_number)
);

alter table deliverables
  drop constraint if exists deliverables_current_version_fk;
alter table deliverables
  add constraint deliverables_current_version_fk foreign key (current_version_id)
  references deliverable_versions(id) deferrable initially deferred;

create table if not exists data_room_manifests (
  id text primary key,
  tenant_id text not null,
  project_id text not null,
  deliverable_id text not null references deliverables(id),
  created_by text not null,
  created_at timestamptz not null
);

create table if not exists data_room_manifest_entries (
  id text primary key,
  manifest_id text not null references data_room_manifests(id) on delete cascade,
  category text not null,
  document_version_id text references decision_document_versions(id),
  deliverable_version_id text references deliverable_versions(id),
  candidate_id text,
  entry_order integer not null check (entry_order >= 0),
  check ((document_version_id is not null) <> (deliverable_version_id is not null))
);

create index if not exists data_room_manifest_entries_order_idx
  on data_room_manifest_entries (manifest_id, entry_order);

-- Platform convergence should add the authoritative tenant/project foreign keys and
-- row-level security policies once Categories 1–3 establish the shared schema names.
