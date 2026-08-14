-- AccelSSA Category 5 reference persistence schema.
-- Category 1 may move these statements into the platform migration framework.
-- Category 2 remains responsible for the final database authorization/RLS convention.

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS gis_geographies (
  geography_id text PRIMARY KEY,
  geography_type text NOT NULL CHECK (geography_type IN (
    'COUNTRY','STATE','REGION','METRO','COUNTY','MUNICIPALITY','ZIP','CENSUS_TRACT','CUSTOM_POLYGON','PARCEL','SITE','BUILDING'
  )),
  scope text NOT NULL CHECK (scope IN ('GLOBAL','TENANT','PROJECT')),
  tenant_id text NULL,
  project_id text NULL,
  canonical_name text NOT NULL,
  display_name text NOT NULL,
  parent_geography_id text NULL REFERENCES gis_geographies(geography_id),
  jurisdiction_code text NULL,
  source_identifier text NULL,
  current_geometry_version integer NOT NULL DEFAULT 1,
  custom_purpose text NULL,
  custom_source_type text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gis_geography_scope_ck CHECK (
    (scope = 'GLOBAL' AND tenant_id IS NULL AND project_id IS NULL)
    OR (scope = 'TENANT' AND tenant_id IS NOT NULL AND project_id IS NULL)
    OR (scope = 'PROJECT' AND tenant_id IS NOT NULL AND project_id IS NOT NULL)
  ),
  CONSTRAINT gis_custom_geography_ck CHECK (
    geography_type <> 'CUSTOM_POLYGON'
    OR (custom_purpose IS NOT NULL AND custom_source_type IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS gis_geographies_type_idx ON gis_geographies (geography_type);
CREATE INDEX IF NOT EXISTS gis_geographies_parent_idx ON gis_geographies (parent_geography_id);
CREATE INDEX IF NOT EXISTS gis_geographies_tenant_project_idx ON gis_geographies (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS gis_geographies_source_idx ON gis_geographies (source_identifier) WHERE source_identifier IS NOT NULL;

CREATE TABLE IF NOT EXISTS gis_geography_geometry_versions (
  geography_id text NOT NULL REFERENCES gis_geographies(geography_id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  geometry geometry(Geometry, 4326) NOT NULL,
  centroid geometry(Point, 4326) NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('AUTHORITATIVE','PROVIDER','DRAWN','UPLOADED','GENERATED','DERIVED')),
  source text NOT NULL,
  source_dataset text NULL,
  source_record_id text NULL,
  source_version text NULL,
  effective_at timestamptz NULL,
  observed_at timestamptz NULL,
  retrieved_at timestamptz NOT NULL,
  confidence text NULL CHECK (confidence IN ('LOW','MEDIUM','HIGH')),
  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (geography_id, version)
);

CREATE INDEX IF NOT EXISTS gis_geometry_versions_geometry_gix
  ON gis_geography_geometry_versions USING gist (geometry);
CREATE INDEX IF NOT EXISTS gis_geometry_versions_centroid_gix
  ON gis_geography_geometry_versions USING gist (centroid);

CREATE TABLE IF NOT EXISTS gis_geography_relationships (
  relationship_id text PRIMARY KEY,
  from_geography_id text NOT NULL REFERENCES gis_geographies(geography_id) ON DELETE CASCADE,
  to_geography_id text NOT NULL REFERENCES gis_geographies(geography_id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('PARENT_CHILD','INTERSECTS','CONTAINS','ADJACENT','OVERLAPS')),
  calculated_from_version integer NULL,
  calculated_to_version integer NULL,
  effective_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_geography_id, to_geography_id, relationship_type, calculated_from_version, calculated_to_version)
);

CREATE INDEX IF NOT EXISTS gis_relationships_from_idx ON gis_geography_relationships (from_geography_id);
CREATE INDEX IF NOT EXISTS gis_relationships_to_idx ON gis_geography_relationships (to_geography_id);

CREATE TABLE IF NOT EXISTS gis_map_layers (
  layer_id text PRIMARY KEY,
  tenant_id text NULL,
  project_id text NULL,
  name text NOT NULL,
  category text NOT NULL,
  geometry_type text NOT NULL,
  source_kind text NOT NULL,
  source_id text NOT NULL,
  min_zoom numeric NULL,
  max_zoom numeric NULL,
  default_visible boolean NOT NULL DEFAULT false,
  supports_filtering boolean NOT NULL DEFAULT true,
  supports_selection boolean NOT NULL DEFAULT true,
  project_scoped boolean NOT NULL DEFAULT false,
  provenance_required boolean NOT NULL DEFAULT true,
  visibility text NOT NULL CHECK (visibility IN ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gis_map_layers_scope_idx ON gis_map_layers (tenant_id, project_id);

CREATE TABLE IF NOT EXISTS gis_saved_map_views (
  saved_map_view_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NULL,
  name text NOT NULL,
  description text NULL,
  visibility text NOT NULL CHECK (visibility IN ('INTERNAL','PROJECT_TEAM','CLIENT','EXTERNAL_SHARED')),
  state jsonb NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gis_saved_map_views_scope_idx ON gis_saved_map_views (tenant_id, project_id);

CREATE TABLE IF NOT EXISTS gis_spatial_analyses (
  analysis_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  project_id text NULL,
  analysis_type text NOT NULL CHECK (analysis_type IN ('DISTANCE','TRAVEL_TIME','TRAVEL_AREA','RADIUS','INTERSECTION','CONTAINMENT')),
  status text NOT NULL CHECK (status IN ('PENDING','COMPLETE','FAILED','STALE')),
  request_hash text NOT NULL,
  request jsonb NOT NULL,
  result_value jsonb NULL,
  result_unit text NULL,
  result_geometry geometry(Geometry, 4326) NULL,
  result_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  lineage jsonb NOT NULL,
  calculated_at timestamptz NOT NULL,
  expires_at timestamptz NULL,
  error_code text NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gis_spatial_analyses_scope_hash_idx
  ON gis_spatial_analyses (tenant_id, project_id, request_hash, status);
CREATE INDEX IF NOT EXISTS gis_spatial_analyses_geometry_gix
  ON gis_spatial_analyses USING gist (result_geometry) WHERE result_geometry IS NOT NULL;
CREATE INDEX IF NOT EXISTS gis_spatial_analyses_expiry_idx
  ON gis_spatial_analyses (expires_at) WHERE expires_at IS NOT NULL;

COMMENT ON TABLE gis_geographies IS 'Canonical and tenant/project-scoped AccelSSA geography identities.';
COMMENT ON TABLE gis_geography_geometry_versions IS 'Immutable versioned authoritative geometry and provenance.';
COMMENT ON TABLE gis_spatial_analyses IS 'Persisted decision-significant spatial calculations and lineage.';
