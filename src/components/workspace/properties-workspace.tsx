"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import type {
  PropertyCandidateAssociationInput,
  PropertyMutation,
  PropertyRegistryFilters,
  PropertyRegistryItem,
  PropertyRegistryResult,
  PropertyWorkspaceCapability,
  PropertyWorkspaceDetail,
} from "@/domains/properties-live/contracts";
import type {
  PropertyAvailabilityStatus,
  PropertyDraft,
  PropertyType,
} from "../../../packages/properties/src/domain/property";
import type { PropertyAttributeObservation, VerificationStatus } from "../../../packages/properties/src/domain/verification";
import styles from "./properties-workspace.module.css";

const propertyTypeLabels: Record<PropertyType, string> = {
  INDUSTRIAL_LAND: "Industrial land",
  INDUSTRIAL_BUILDING: "Industrial building",
  OFFICE: "Office",
  WAREHOUSE: "Warehouse",
  RETAIL: "Retail",
  DATA_CENTER_SITE: "Data center site",
  MIXED_USE: "Mixed use",
  CUSTOM: "Custom",
};
const propertyTypes = Object.keys(propertyTypeLabels) as PropertyType[];

const availabilityLabels: Record<PropertyAvailabilityStatus, string> = {
  AVAILABLE: "Available",
  PARTIALLY_AVAILABLE: "Partially available",
  UNDER_OPTION: "Under option",
  UNDER_CONTRACT: "Under contract",
  UNAVAILABLE: "Unavailable",
  UNKNOWN: "Unknown",
};
const availabilityStatuses = Object.keys(availabilityLabels) as PropertyAvailabilityStatus[];

const verificationLabels: Record<VerificationStatus, string> = {
  UNVERIFIED: "Unverified",
  SELF_REPORTED: "Self-reported",
  DOCUMENT_VERIFIED: "Document verified",
  CONSULTANT_VERIFIED: "Consultant verified",
  AUTHORITY_VERIFIED: "Authority verified",
  STALE: "Stale",
};
const verificationStatuses = Object.keys(verificationLabels) as VerificationStatus[];

const readinessLabels = {
  UNKNOWN: "Unknown",
  NOT_READY: "Not ready",
  CONDITIONAL: "Conditional",
  READY: "Ready",
} as const;

type DetailTab = "overview" | "site" | "utilities" | "access" | "readiness" | "verification" | "evidence";
const detailTabs: Array<[DetailTab, string]> = [
  ["overview", "Overview"],
  ["site", "Site & buildings"],
  ["utilities", "Utilities"],
  ["access", "Access & environment"],
  ["readiness", "Readiness"],
  ["verification", "Verification"],
  ["evidence", "Evidence & projects"],
];

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  capability?: PropertyWorkspaceCapability;
  error?: { code: string; message: string };
};

type EditorState = {
  canonicalName: string;
  propertyType: PropertyType;
  customPropertyType: string;
  availabilityStatus: PropertyAvailabilityStatus;
  jurisdiction: string;
  addressLine1: string;
  city: string;
  county: string;
  stateOrProvince: string;
  postalCode: string;
  parcelIds: string;
  ownerOrganizationId: string;
  brokerOrganizationId: string;
  economicDevelopmentContactId: string;
  totalAcres: string;
  availableAcres: string;
  developableAcres: string;
  adjacentAcres: string;
  zoning: string;
  askingPrice: string;
};

const emptyEditor: EditorState = {
  canonicalName: "",
  propertyType: "INDUSTRIAL_LAND",
  customPropertyType: "",
  availabilityStatus: "UNKNOWN",
  jurisdiction: "",
  addressLine1: "",
  city: "",
  county: "",
  stateOrProvince: "",
  postalCode: "",
  parcelIds: "",
  ownerOrganizationId: "",
  brokerOrganizationId: "",
  economicDevelopmentContactId: "",
  totalAcres: "",
  availableAcres: "",
  developableAcres: "",
  adjacentAcres: "",
  zoning: "",
  askingPrice: "",
};

export function PropertiesWorkspace() {
  const [capability, setCapability] = useState<PropertyWorkspaceCapability | null>(null);
  const [filters, setFilters] = useState<PropertyRegistryFilters>({});
  const [registry, setRegistry] = useState<PropertyRegistryResult>({ items: [], total: 0, filters: {} });
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PropertyWorkspaceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editor, setEditor] = useState<EditorState>(emptyEditor);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [projectReference, setProjectReference] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/v1/properties/status", { cache: "no-store" });
        const body = await response.json() as ApiEnvelope<never> & { capability: PropertyWorkspaceCapability };
        if (!active) return;
        setCapability(body.capability);
        if (!body.capability.readRegistry) setLoading(false);
      } catch {
        if (active) {
          setCapability({
            state: "CONFIGURATION_REQUIRED",
            readRegistry: false,
            mutateProperties: false,
            associateProjects: false,
            evidenceLinks: false,
            reasons: ["Property service status could not be loaded."],
          });
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!capability?.readRegistry) return;
    let active = true;
    setLoading(true);
    void (async () => {
      const params = buildFilterParams(filters);
      const response = await fetch(`/api/v1/properties${params ? `?${params}` : ""}`, { cache: "no-store" });
      const body = await response.json() as ApiEnvelope<PropertyRegistryResult>;
      if (!active) return;
      if (body.capability) setCapability(body.capability);
      if (response.ok && body.data) setRegistry(body.data);
      else setActionMessage(body.error?.message ?? "Property registry could not be loaded.");
      setLoading(false);
    })();
    return () => { active = false; };
  }, [capability?.readRegistry, filters]);

  const configurationReason = capability?.reasons[0] ?? "Authoritative property storage is not configured.";

  async function openDetail(propertyId: string) {
    if (!capability?.readRegistry) return;
    setSelectedPropertyId(propertyId);
    setDetailLoading(true);
    setActiveTab("overview");
    const response = await fetch(`/api/v1/properties/${encodeURIComponent(propertyId)}`, { cache: "no-store" });
    const body = await response.json() as ApiEnvelope<PropertyWorkspaceDetail>;
    if (response.ok && body.data) setDetail(body.data);
    else setActionMessage(body.error?.message ?? "Property detail could not be loaded.");
    setDetailLoading(false);
  }

  async function refreshSelected() {
    if (selectedPropertyId) await openDetail(selectedPropertyId);
  }

  function openCreate() {
    setEditor(emptyEditor);
    setEditorMode("create");
    setActionMessage(null);
  }

  function openEdit() {
    if (!detail) return;
    const property = detail.profile.property;
    const site = detail.profile.site;
    setEditor({
      canonicalName: property.canonicalName,
      propertyType: property.propertyType,
      customPropertyType: property.customPropertyType ?? "",
      availabilityStatus: property.availabilityStatus,
      jurisdiction: property.jurisdiction ?? "",
      addressLine1: property.address?.line1 ?? "",
      city: property.address?.city ?? "",
      county: property.address?.county ?? "",
      stateOrProvince: property.address?.stateOrProvince ?? "",
      postalCode: property.address?.postalCode ?? "",
      parcelIds: property.parcelIds.join(", "),
      ownerOrganizationId: property.ownerOrganizationId ?? "",
      brokerOrganizationId: property.brokerOrganizationId ?? "",
      economicDevelopmentContactId: property.economicDevelopmentContactId ?? "",
      totalAcres: numberInput(site?.totalAcres),
      availableAcres: numberInput(site?.availableAcres),
      developableAcres: numberInput(site?.developableAcres),
      adjacentAcres: numberInput(site?.adjacentAcres),
      zoning: site?.zoning ?? "",
      askingPrice: numberInput(site?.askingPrice),
    });
    setEditorMode("edit");
    setActionMessage(null);
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!capability?.mutateProperties) {
      setActionMessage(configurationReason);
      return;
    }
    const draft = editorToDraft(editor);
    try {
      if (editorMode === "create") {
        const response = await fetch("/api/v1/properties", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(draft),
        });
        const body = await response.json() as ApiEnvelope<PropertyWorkspaceDetail>;
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Property could not be created.");
        setEditorMode(null);
        setSelectedPropertyId(body.data.profile.property.propertyId);
        setDetail(body.data);
      } else if (editorMode === "edit" && detail) {
        const propertyId = detail.profile.property.propertyId;
        const coreMutation: PropertyMutation = { operation: "UPDATE_PROPERTY", patch: editorToPatch(editor) };
        const coreResponse = await patchProperty(propertyId, coreMutation);
        setDetail(coreResponse);
        const hasSiteInput = [editor.totalAcres, editor.availableAcres, editor.developableAcres, editor.adjacentAcres, editor.zoning, editor.askingPrice].some((value) => value.trim());
        if (hasSiteInput || detail.profile.site) {
          const previous = detail.profile.site;
          const siteMutation: PropertyMutation = {
            operation: "SAVE_SITE",
            site: {
              totalAcres: optionalNumber(editor.totalAcres),
              availableAcres: optionalNumber(editor.availableAcres),
              developableAcres: optionalNumber(editor.developableAcres),
              adjacentAcres: optionalNumber(editor.adjacentAcres),
              zoning: optionalText(editor.zoning),
              askingPrice: optionalNumber(editor.askingPrice),
              ...(previous?.topography ? { topography: previous.topography } : {}),
              ...(previous?.frontage ? { frontage: previous.frontage } : {}),
              ...(previous?.accessDescription ? { accessDescription: previous.accessDescription } : {}),
              ...(previous?.ownershipStatus ? { ownershipStatus: previous.ownershipStatus } : {}),
              ...(previous?.askingPriceCurrency ? { askingPriceCurrency: previous.askingPriceCurrency } : {}),
              ...(previous?.expansionPotential ? { expansionPotential: previous.expansionPotential } : {}),
            },
          };
          setDetail(await patchProperty(propertyId, siteMutation));
        }
        setEditorMode(null);
      }
      setActionMessage("Property changes saved.");
      if (capability.readRegistry) setFilters((current) => ({ ...current }));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Property changes could not be saved.");
    }
  }

  async function patchProperty(propertyId: string, mutation: PropertyMutation) {
    const response = await fetch(`/api/v1/properties/${encodeURIComponent(propertyId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mutation),
    });
    const body = await response.json() as ApiEnvelope<PropertyWorkspaceDetail>;
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Property update failed.");
    return body.data;
  }

  async function associateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || !projectReference.trim()) return;
    if (!capability?.associateProjects) {
      setActionMessage(capability?.reasons.find((reason) => reason.toLowerCase().includes("project")) ?? configurationReason);
      return;
    }
    const input: PropertyCandidateAssociationInput = { projectId: projectReference.trim(), stage: "IDENTIFIED" };
    const response = await fetch(`/api/v1/properties/${encodeURIComponent(detail.profile.property.propertyId)}/candidate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await response.json() as ApiEnvelope<unknown>;
    if (!response.ok) setActionMessage(body.error?.message ?? "Project association failed.");
    else {
      setActionMessage("Property associated with the current project.");
      setProjectReference("");
      await refreshSelected();
    }
  }

  return (
    <div className={styles.workspace}>
      <div className="page-header-with-action">
        <PageHeader
          eyebrow="Real estate"
          title="Properties"
          description="Maintain sites and buildings, source critical facts, and track development readiness separately from market attractiveness."
        />
        <button className="button button-primary" type="button" onClick={openCreate}>Add Property</button>
      </div>

      {capability?.state === "CONFIGURATION_REQUIRED" ? (
        <div className={styles.configurationBar} role="status">
          <strong>Property data connection required</strong>
          <span>{configurationReason}</span>
          {capability.reasons.length > 1 ? <span className={styles.moreReasons}>+{capability.reasons.length - 1} dependency</span> : null}
        </div>
      ) : null}
      {actionMessage ? (
        <div className={styles.actionMessage} role="status">
          <span>{actionMessage}</span>
          <button type="button" onClick={() => setActionMessage(null)} aria-label="Dismiss message">×</button>
        </div>
      ) : null}

      <section className={styles.registrySurface} aria-label="Property registry">
        <div className={styles.filters}>
          <label className={styles.searchField}>
            <span>Search</span>
            <input value={filters.query ?? ""} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value || undefined }))} placeholder="Name, jurisdiction, parcel" />
          </label>
          <FilterSelect label="Type" value={filters.propertyType ?? ""} onChange={(value) => setFilters((current) => ({ ...current, propertyType: value ? value as PropertyType : undefined }))}>
            {propertyTypes.map((type) => <option key={type} value={type}>{propertyTypeLabels[type]}</option>)}
          </FilterSelect>
          <FilterSelect label="Availability" value={filters.availabilityStatus ?? ""} onChange={(value) => setFilters((current) => ({ ...current, availabilityStatus: value ? value as PropertyAvailabilityStatus : undefined }))}>
            {availabilityStatuses.map((status) => <option key={status} value={status}>{availabilityLabels[status]}</option>)}
          </FilterSelect>
          <FilterSelect label="Readiness" value={filters.readinessState ?? ""} onChange={(value) => setFilters((current) => ({ ...current, readinessState: value ? value as keyof typeof readinessLabels : undefined }))}>
            {Object.entries(readinessLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </FilterSelect>
          <FilterSelect label="Verification" value={filters.verificationStatus ?? ""} onChange={(value) => setFilters((current) => ({ ...current, verificationStatus: value ? value as VerificationStatus : undefined }))}>
            {verificationStatuses.map((status) => <option key={status} value={status}>{verificationLabels[status]}</option>)}
          </FilterSelect>
          <button className={`button button-secondary ${styles.clearButton}`} type="button" onClick={() => setFilters({})}>Clear</button>
        </div>

        <div className={styles.tableMeta}>
          <strong>{loading ? "Loading…" : `${registry.total} ${registry.total === 1 ? "property" : "properties"}`}</strong>
          <span>Unknown values remain unknown until a sourced observation is recorded.</span>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.propertyTable}>
            <thead><tr><th>Property</th><th>Type</th><th>Jurisdiction</th><th>Site</th><th>Building</th><th>Availability</th><th>Readiness</th><th>Verification</th><th>Updated</th></tr></thead>
            <tbody>
              {!loading && registry.items.map((item) => (
                <PropertyRow key={item.property.propertyId} item={item} onOpen={() => void openDetail(item.property.propertyId)} />
              ))}
            </tbody>
          </table>
          {!loading && registry.items.length === 0 ? (
            <div className={styles.emptyRegistry}>
              <strong>{capability?.readRegistry ? "No properties match these filters" : "No authoritative property records are available"}</strong>
              <span>{capability?.readRegistry ? "Adjust the filters or add a property." : "The registry will load once authenticated tenant context and durable property storage are connected."}</span>
            </div>
          ) : null}
        </div>
      </section>

      {selectedPropertyId ? (
        <div className={styles.drawerLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPropertyId(null); }}>
          <aside className={styles.drawer} aria-label="Property detail">
            {detailLoading ? <div className={styles.drawerLoading}>Loading property…</div> : detail ? (
              <>
                <div className={styles.drawerHeader}>
                  <div>
                    <div className={styles.drawerEyebrow}>{propertyTypeLabels[detail.profile.property.propertyType]}</div>
                    <h2>{detail.profile.property.canonicalName}</h2>
                    <div className={styles.drawerMeta}>{detail.profile.property.jurisdiction ?? "Jurisdiction unknown"} · {availabilityLabels[detail.profile.property.availabilityStatus]}</div>
                  </div>
                  <div className={styles.drawerActions}>
                    <button className="button button-secondary" type="button" onClick={openEdit}>Edit</button>
                    <button className={styles.iconButton} type="button" onClick={() => { setSelectedPropertyId(null); setDetail(null); }} aria-label="Close property detail">×</button>
                  </div>
                </div>
                <div className={styles.tabs} role="tablist" aria-label="Property detail sections">
                  {detailTabs.map(([value, label]) => (
                    <button key={value} type="button" className={activeTab === value ? styles.activeTab : ""} onClick={() => setActiveTab(value)}>{label}</button>
                  ))}
                </div>
                <div className={styles.drawerBody}>
                  <PropertyDetailTab tab={activeTab} detail={detail} capability={capability} projectReference={projectReference} setProjectReference={setProjectReference} associateProject={associateProject} />
                </div>
              </>
            ) : <div className={styles.drawerLoading}>Property detail is unavailable.</div>}
          </aside>
        </div>
      ) : null}

      {editorMode ? (
        <PropertyEditor
          mode={editorMode}
          state={editor}
          setState={setEditor}
          canSave={Boolean(capability?.mutateProperties)}
          blockedReason={configurationReason}
          onClose={() => setEditorMode(null)}
          onSubmit={submitEditor}
        />
      ) : null}
    </div>
  );
}

function PropertyRow({ item, onOpen }: { item: PropertyRegistryItem; onOpen: () => void }) {
  const property = item.property;
  return (
    <tr>
      <td><button className={styles.propertyLink} type="button" onClick={onOpen}>{property.canonicalName}</button><div className={styles.subtle}>{property.parcelIds.length ? `${property.parcelIds.length} parcel${property.parcelIds.length === 1 ? "" : "s"}` : "Parcel unknown"}</div></td>
      <td>{propertyTypeLabels[property.propertyType]}</td>
      <td>{property.jurisdiction ?? "Unknown"}</td>
      <td>{item.site?.availableAcres !== undefined ? `${formatNumber(item.site.availableAcres)} ac available` : item.site?.totalAcres !== undefined ? `${formatNumber(item.site.totalAcres)} ac total` : "Unknown"}</td>
      <td>{item.availableBuildingSquareFeet !== undefined ? `${formatNumber(item.availableBuildingSquareFeet)} SF available` : item.totalBuildingSquareFeet !== undefined ? `${formatNumber(item.totalBuildingSquareFeet)} SF total` : "Unknown"}</td>
      <td><StatusPill value={availabilityLabels[property.availabilityStatus]} tone={property.availabilityStatus === "UNKNOWN" ? "neutral" : property.availabilityStatus === "AVAILABLE" ? "positive" : "standard"} /></td>
      <td><StatusPill value={readinessLabels[item.readinessSummary.overallState]} tone={item.readinessSummary.overallState === "READY" ? "positive" : item.readinessSummary.overallState === "NOT_READY" ? "negative" : "neutral"} /></td>
      <td><StatusPill value={verificationLabels[item.verificationStatus]} tone={item.verificationStatus === "AUTHORITY_VERIFIED" || item.verificationStatus === "CONSULTANT_VERIFIED" ? "positive" : item.verificationStatus === "STALE" ? "negative" : "neutral"} /></td>
      <td>{formatDate(property.updatedAt)}</td>
    </tr>
  );
}

function PropertyDetailTab({
  tab, detail, capability, projectReference, setProjectReference, associateProject,
}: {
  tab: DetailTab;
  detail: PropertyWorkspaceDetail;
  capability: PropertyWorkspaceCapability | null;
  projectReference: string;
  setProjectReference: (value: string) => void;
  associateProject: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const { property } = detail.profile;
  const site = detail.profile.site;
  if (tab === "overview") return (
    <div className={styles.detailStack}>
      <DetailSection title="Identity & location">
        <FactGrid>
          <Fact label="Availability" value={availabilityLabels[property.availabilityStatus]} observation={findObservation(detail, "property.availabilityStatus")} />
          <Fact label="Jurisdiction" value={property.jurisdiction} observation={findObservation(detail, "property.jurisdiction")} />
          <Fact label="Address" value={formatAddress(property.address)} observation={findObservation(detail, "property.address")} />
          <Fact label="Parcels" value={property.parcelIds.length ? property.parcelIds.join(", ") : undefined} observation={findObservation(detail, "property.parcelIds")} />
        </FactGrid>
      </DetailSection>
      <DetailSection title="Site & commercial terms">
        <FactGrid>
          <Fact label="Total acreage" value={unitValue(site?.totalAcres, "ac")} observation={findObservation(detail, "site.totalAcres")} />
          <Fact label="Available acreage" value={unitValue(site?.availableAcres, "ac")} observation={findObservation(detail, "site.availableAcres")} />
          <Fact label="Developable acreage" value={unitValue(site?.developableAcres, "ac")} observation={findObservation(detail, "site.developableAcres")} />
          <Fact label="Zoning" value={site?.zoning} observation={findObservation(detail, "site.zoning")} />
          <Fact label="Asking price" value={moneyValue(site?.askingPrice, site?.askingPriceCurrency)} observation={findObservation(detail, "site.askingPrice")} />
          <Fact label="Ownership status" value={site?.ownershipStatus} observation={findObservation(detail, "site.ownershipStatus")} />
        </FactGrid>
      </DetailSection>
      <DetailSection title="Ownership & contacts">
        <FactGrid>
          <Fact label="Owner" value={property.ownerOrganizationId} observation={findObservation(detail, "property.ownerOrganizationId")} />
          <Fact label="Broker" value={property.brokerOrganizationId} observation={findObservation(detail, "property.brokerOrganizationId")} />
          <Fact label="Economic development contact" value={property.economicDevelopmentContactId} observation={findObservation(detail, "property.economicDevelopmentContactId")} />
        </FactGrid>
      </DetailSection>
    </div>
  );

  if (tab === "site") return (
    <div className={styles.detailStack}>
      <DetailSection title="Site characteristics">
        <FactGrid>
          <Fact label="Total acreage" value={unitValue(site?.totalAcres, "ac")} observation={findObservation(detail, "site.totalAcres")} />
          <Fact label="Available acreage" value={unitValue(site?.availableAcres, "ac")} observation={findObservation(detail, "site.availableAcres")} />
          <Fact label="Developable acreage" value={unitValue(site?.developableAcres, "ac")} observation={findObservation(detail, "site.developableAcres")} />
          <Fact label="Adjacent acreage" value={unitValue(site?.adjacentAcres, "ac")} observation={findObservation(detail, "site.adjacentAcres")} />
          <Fact label="Topography" value={site?.topography} observation={findObservation(detail, "site.topography")} />
          <Fact label="Frontage" value={site?.frontage} observation={findObservation(detail, "site.frontage")} />
          <Fact label="Access" value={site?.accessDescription} observation={findObservation(detail, "site.accessDescription")} />
          <Fact label="Expansion potential" value={site?.expansionPotential} observation={findObservation(detail, "site.expansionPotential")} />
        </FactGrid>
      </DetailSection>
      <DetailSection title={`Buildings (${detail.profile.buildings.length})`}>
        {detail.profile.buildings.length ? <div className={styles.compactTable}><table><thead><tr><th>Building</th><th>Total SF</th><th>Available SF</th><th>Clear height</th><th>Docks</th><th>Occupancy</th></tr></thead><tbody>{detail.profile.buildings.map((building) => <tr key={building.buildingId}><td>{building.name ?? building.buildingId}</td><td>{knownNumber(building.totalSquareFeet)}</td><td>{knownNumber(building.availableSquareFeet)}</td><td>{unitValue(building.ceilingHeightFeet, "ft")}</td><td>{knownNumber(building.dockDoors)}</td><td>{building.occupancyStatus ?? "Unknown"}</td></tr>)}</tbody></table></div> : <EmptyLine text="No building records are linked to this property." />}
      </DetailSection>
    </div>
  );

  if (tab === "utilities") return (
    <DetailSection title="Property utilities" note="Capacity is shown only when it has been entered; missing capacity is never treated as zero.">
      {detail.profile.utilities.length ? <div className={styles.compactTable}><table><thead><tr><th>Utility</th><th>Provider</th><th>Existing</th><th>Available</th><th>Upgrade</th><th>Source / verification</th></tr></thead><tbody>{detail.profile.utilities.map((utility) => { const observation = findObservation(detail, `utility.${utility.utilityType}.availableCapacity`); return <tr key={utility.utilityProfileId}><td>{titleCase(utility.utilityType)}</td><td>{utility.providerOrganizationId ?? "Unknown"}</td><td>{capacityValue(utility.existingCapacity)}</td><td>{capacityValue(utility.availableCapacity)}</td><td>{utility.upgradeRequired === undefined ? "Unknown" : utility.upgradeRequired ? utility.upgradeDescription ?? "Required" : "Not required"}</td><td><SourceVerification observation={observation} /></td></tr>; })}</tbody></table></div> : <EmptyLine text="No utility capacity has been recorded." />}
    </DetailSection>
  );

  if (tab === "access") return (
    <div className={styles.detailStack}>
      <DetailSection title="Transportation access">
        <FactGrid>
          <Fact label="Interstate distance" value={distanceValue(detail.profile.transportation?.interstateDistance, detail.profile.transportation?.interstateDistanceUnit)} observation={findObservation(detail, "transportation.interstateDistance")} />
          <Fact label="Highway distance" value={distanceValue(detail.profile.transportation?.highwayDistance, detail.profile.transportation?.highwayDistanceUnit)} observation={findObservation(detail, "transportation.highwayDistance")} />
          <Fact label="Rail service" value={detail.profile.transportation?.railService} observation={findObservation(detail, "transportation.railService")} />
          <Fact label="Airport distance" value={distanceValue(detail.profile.transportation?.airportDistance, detail.profile.transportation?.airportDistanceUnit)} observation={findObservation(detail, "transportation.airportDistance")} />
          <Fact label="Port distance" value={distanceValue(detail.profile.transportation?.portDistance, detail.profile.transportation?.portDistanceUnit)} observation={findObservation(detail, "transportation.portDistance")} />
          <Fact label="Truck access" value={detail.profile.transportation?.truckAccess} observation={findObservation(detail, "transportation.truckAccess")} />
          <Fact label="Ingress / egress" value={detail.profile.transportation?.ingressEgress} observation={findObservation(detail, "transportation.ingressEgress")} />
          <Fact label="Road improvements" value={detail.profile.transportation?.roadImprovements} observation={findObservation(detail, "transportation.roadImprovements")} />
        </FactGrid>
      </DetailSection>
      <DetailSection title="Environmental information">
        {detail.profile.environmentalFindings.length ? <div className={styles.compactTable}><table><thead><tr><th>Topic</th><th>State</th><th>Finding</th><th>Observed</th><th>Evidence</th></tr></thead><tbody>{detail.profile.environmentalFindings.map((finding) => <tr key={finding.findingId}><td>{titleCase(finding.topic)}</td><td>{titleCase(finding.state)}</td><td>{finding.summary ?? "No summary"}</td><td>{finding.observedAt ? formatDate(finding.observedAt) : "Unknown"}</td><td>{finding.evidenceIds.length || "None linked"}</td></tr>)}</tbody></table></div> : <EmptyLine text="No environmental findings have been recorded." />}
      </DetailSection>
    </div>
  );

  if (tab === "readiness") return (
    <div className={styles.detailStack}>
      <div className={styles.readinessNotice}><strong>Development readiness: {readinessLabels[detail.readinessSummary.overallState]}</strong><span>Market attractiveness is evaluated separately and is not included in this readiness state.</span></div>
      <div className={styles.readinessMetrics}><span><strong>{detail.readinessSummary.readyDimensions}</strong> ready</span><span><strong>{detail.readinessSummary.conditionalDimensions}</strong> conditional</span><span><strong>{detail.readinessSummary.blockedDimensions}</strong> blocked</span><span><strong>{detail.readinessSummary.unknownDimensions}</strong> unknown</span><span><strong>{detail.readinessSummary.evidenceGapCount}</strong> evidence gaps</span></div>
      <DetailSection title="Readiness dimensions">
        {detail.readinessItems.length ? <div className={styles.compactTable}><table><thead><tr><th>Dimension</th><th>State</th><th>Required work / finding</th><th>Schedule</th><th>Confidence</th><th>Evidence</th></tr></thead><tbody>{detail.readinessItems.map((item) => <tr key={item.readinessItemId}><td>{item.customDimension ?? titleCase(item.dimension)}</td><td>{titleCase(item.state)}</td><td>{item.requiredWork ?? item.summary ?? "—"}</td><td>{item.expectedCompletionDate ? `Target ${formatDate(item.expectedCompletionDate)}` : "Unknown"}</td><td>{item.confidence ? titleCase(item.confidence) : "Unknown"}</td><td>{item.evidenceIds.length || "None linked"}</td></tr>)}</tbody></table></div> : <EmptyLine text="No readiness dimensions have been assessed." />}
      </DetailSection>
    </div>
  );

  if (tab === "verification") return (
    <DetailSection title="Attribute provenance & freshness" note="Each factual observation retains its own source, date and verification state.">
      {detail.observations.length ? <div className={styles.compactTable}><table><thead><tr><th>Attribute</th><th>Value</th><th>Source</th><th>Verification</th><th>Vintage</th><th>Freshness</th></tr></thead><tbody>{detail.observations.map((observation) => <tr key={observation.observationId}><td><span className="code">{observation.attributeKey}</span></td><td>{observationValue(observation)}</td><td>{observation.source ?? "No source recorded"}</td><td>{verificationLabels[effectiveStatus(observation)]}</td><td>{formatDate(observation.observationDate ?? observation.effectiveDate ?? observation.createdAt)}</td><td>{freshnessText(observation)}</td></tr>)}</tbody></table></div> : <EmptyLine text="No sourced attribute observations have been recorded." />}
    </DetailSection>
  );

  return (
    <div className={styles.detailStack}>
      <DetailSection title="Evidence & documents">
        {detail.evidenceLinks.length ? <ul className={styles.evidenceList}>{detail.evidenceLinks.map((link) => <li key={link.evidenceId}>{link.href ? <a href={link.href} target="_blank" rel="noreferrer">{link.label}</a> : <span>{link.label}</span>}<small>{link.category ?? "Evidence"}</small></li>)}</ul> : <EmptyLine text={capability?.evidenceLinks ? "No evidence or document links are attached." : "Evidence links will appear when the document service is connected."} />}
      </DetailSection>
      <DetailSection title="Project candidate associations">
        {detail.candidateAssociations.length ? <div className={styles.compactTable}><table><thead><tr><th>Project</th><th>Candidate stage</th><th>Updated</th></tr></thead><tbody>{detail.candidateAssociations.map((item) => <tr key={item.candidateId}><td>{item.projectId}</td><td>{titleCase(item.stage)}</td><td>{formatDate(item.updatedAt)}</td></tr>)}</tbody></table></div> : <EmptyLine text="This property is not associated with a project in the current workspace." />}
        <form className={styles.associationForm} onSubmit={associateProject}>
          <label><span>Current project reference</span><input value={projectReference} onChange={(event) => setProjectReference(event.target.value)} placeholder="Select or enter current project" disabled={!capability?.associateProjects} /></label>
          <button className="button button-secondary" type="submit" disabled={!capability?.associateProjects || !projectReference.trim()}>Associate</button>
        </form>
        {!capability?.associateProjects ? <p className={styles.inlineBlocked}>Project association is unavailable until the shared workspace supplies an authoritative project context.</p> : null}
      </DetailSection>
    </div>
  );
}

function PropertyEditor({ mode, state, setState, canSave, blockedReason, onClose, onSubmit }: {
  mode: "create" | "edit";
  state: EditorState;
  setState: (state: EditorState) => void;
  canSave: boolean;
  blockedReason: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const set = (key: keyof EditorState, value: string) => setState({ ...state, [key]: value });
  return (
    <div className={styles.modalLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className={styles.modal} onSubmit={onSubmit}>
        <div className={styles.modalHeader}><div><div className={styles.drawerEyebrow}>Property registry</div><h2>{mode === "create" ? "Add property" : "Edit property"}</h2></div><button className={styles.iconButton} type="button" onClick={onClose} aria-label="Close editor">×</button></div>
        {!canSave ? <div className={styles.writeBlocked}><strong>Authoritative save unavailable</strong><span>{blockedReason}</span></div> : null}
        <div className={styles.formSection}><h3>Identity</h3><div className={styles.formGrid}>
          <EditorField label="Property name"><input required value={state.canonicalName} onChange={(event) => set("canonicalName", event.target.value)} /></EditorField>
          <EditorField label="Type"><select value={state.propertyType} onChange={(event) => set("propertyType", event.target.value)}>{propertyTypes.map((type) => <option key={type} value={type}>{propertyTypeLabels[type]}</option>)}</select></EditorField>
          {state.propertyType === "CUSTOM" ? <EditorField label="Custom type"><input required value={state.customPropertyType} onChange={(event) => set("customPropertyType", event.target.value)} /></EditorField> : null}
          <EditorField label="Availability"><select value={state.availabilityStatus} onChange={(event) => set("availabilityStatus", event.target.value)}>{availabilityStatuses.map((status) => <option key={status} value={status}>{availabilityLabels[status]}</option>)}</select></EditorField>
          <EditorField label="Jurisdiction"><input value={state.jurisdiction} onChange={(event) => set("jurisdiction", event.target.value)} /></EditorField>
          <EditorField label="Parcel references"><input value={state.parcelIds} onChange={(event) => set("parcelIds", event.target.value)} placeholder="Comma separated" /></EditorField>
        </div></div>
        <div className={styles.formSection}><h3>Address</h3><div className={styles.formGrid}>
          <EditorField label="Street"><input value={state.addressLine1} onChange={(event) => set("addressLine1", event.target.value)} /></EditorField>
          <EditorField label="City"><input value={state.city} onChange={(event) => set("city", event.target.value)} /></EditorField>
          <EditorField label="County"><input value={state.county} onChange={(event) => set("county", event.target.value)} /></EditorField>
          <EditorField label="State / province"><input value={state.stateOrProvince} onChange={(event) => set("stateOrProvince", event.target.value)} /></EditorField>
          <EditorField label="Postal code"><input value={state.postalCode} onChange={(event) => set("postalCode", event.target.value)} /></EditorField>
        </div></div>
        <div className={styles.formSection}><h3>Ownership & contacts</h3><div className={styles.formGrid}>
          <EditorField label="Owner reference"><input value={state.ownerOrganizationId} onChange={(event) => set("ownerOrganizationId", event.target.value)} /></EditorField>
          <EditorField label="Broker reference"><input value={state.brokerOrganizationId} onChange={(event) => set("brokerOrganizationId", event.target.value)} /></EditorField>
          <EditorField label="Economic development contact"><input value={state.economicDevelopmentContactId} onChange={(event) => set("economicDevelopmentContactId", event.target.value)} /></EditorField>
        </div></div>
        {mode === "edit" ? <div className={styles.formSection}><h3>Site & commercial terms</h3><div className={styles.formGrid}>
          <EditorField label="Total acres"><input inputMode="decimal" value={state.totalAcres} onChange={(event) => set("totalAcres", event.target.value)} /></EditorField>
          <EditorField label="Available acres"><input inputMode="decimal" value={state.availableAcres} onChange={(event) => set("availableAcres", event.target.value)} /></EditorField>
          <EditorField label="Developable acres"><input inputMode="decimal" value={state.developableAcres} onChange={(event) => set("developableAcres", event.target.value)} /></EditorField>
          <EditorField label="Adjacent acres"><input inputMode="decimal" value={state.adjacentAcres} onChange={(event) => set("adjacentAcres", event.target.value)} /></EditorField>
          <EditorField label="Zoning"><input value={state.zoning} onChange={(event) => set("zoning", event.target.value)} /></EditorField>
          <EditorField label="Asking price"><input inputMode="decimal" value={state.askingPrice} onChange={(event) => set("askingPrice", event.target.value)} /></EditorField>
        </div></div> : null}
        <div className={styles.modalFooter}><button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={!canSave}>{mode === "create" ? "Add property" : "Save changes"}</button></div>
      </form>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className={styles.filterField}><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="">All</option>{children}</select></label>;
}
function EditorField({ label, children }: { label: string; children: ReactNode }) { return <label className={styles.editorField}><span>{label}</span>{children}</label>; }
function DetailSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) { return <section className={styles.detailSection}><div className={styles.sectionHeading}><h3>{title}</h3>{note ? <p>{note}</p> : null}</div>{children}</section>; }
function FactGrid({ children }: { children: ReactNode }) { return <div className={styles.factGrid}>{children}</div>; }
function Fact({ label, value, observation }: { label: string; value: ReactNode | undefined | null; observation?: PropertyAttributeObservation }) { return <div className={styles.fact}><dt>{label}</dt><dd>{value ?? "Unknown"}</dd><SourceVerification observation={observation} /></div>; }
function EmptyLine({ text }: { text: string }) { return <div className={styles.emptyLine}>{text}</div>; }
function StatusPill({ value, tone }: { value: string; tone: "positive" | "negative" | "neutral" | "standard" }) { return <span className={`${styles.pill} ${styles[tone]}`}>{value}</span>; }
function SourceVerification({ observation }: { observation?: PropertyAttributeObservation }) { return <div className={styles.provenance}><span>{observation?.source ?? "No source recorded"}</span><span>·</span><span>{observation ? verificationLabels[effectiveStatus(observation)] : "Unverified"}</span></div>; }

function findObservation(detail: PropertyWorkspaceDetail, key: string) { return detail.observations.find((item) => item.attributeKey === key); }
function effectiveStatus(observation: PropertyAttributeObservation): VerificationStatus { return observation.expirationDate && Date.parse(observation.expirationDate) <= Date.now() ? "STALE" : observation.verificationStatus; }
function freshnessText(observation: PropertyAttributeObservation) { if (!observation.expirationDate) return "No expiry recorded"; return effectiveStatus(observation) === "STALE" ? `Expired ${formatDate(observation.expirationDate)}` : `Current through ${formatDate(observation.expirationDate)}`; }
function observationValue(observation: PropertyAttributeObservation) { const value = observation.value; if (value === null) return "Unknown"; if (typeof value === "object") return JSON.stringify(value); return `${String(value)}${observation.unit ? ` ${observation.unit}` : ""}`; }
function formatAddress(address: PropertyWorkspaceDetail["profile"]["property"]["address"]) { if (!address) return undefined; const parts = [address.line1, address.city, address.county, address.stateOrProvince, address.postalCode].filter(Boolean); return parts.length ? parts.join(", ") : undefined; }
function capacityValue(capacity: { value: number; unit: string } | undefined) { return capacity ? `${formatNumber(capacity.value)} ${capacity.unit}` : "Unknown"; }
function distanceValue(value?: number, unit?: string) { return value === undefined ? "Unknown" : `${formatNumber(value)}${unit ? ` ${unit}` : ""}`; }
function unitValue(value: number | undefined, unit: string) { return value === undefined ? "Unknown" : `${formatNumber(value)} ${unit}`; }
function knownNumber(value: number | undefined) { return value === undefined ? "Unknown" : formatNumber(value); }
function moneyValue(value?: number, currency?: string) { if (value === undefined) return "Unknown"; return `${currency ? `${currency} ` : ""}${formatNumber(value)}`; }
function formatNumber(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value); }
function formatDate(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date) : value; }
function titleCase(value: string) { return value.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function numberInput(value?: number) { return value === undefined ? "" : String(value); }
function optionalNumber(value: string) { const trimmed = value.trim(); if (!trimmed) return undefined; const parsed = Number(trimmed); return Number.isFinite(parsed) ? parsed : undefined; }
function optionalText(value: string) { const trimmed = value.trim(); return trimmed || undefined; }
function parcelValues(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }
function addressFromEditor(state: EditorState) { const address = { line1: optionalText(state.addressLine1), city: optionalText(state.city), county: optionalText(state.county), stateOrProvince: optionalText(state.stateOrProvince), postalCode: optionalText(state.postalCode) }; return Object.values(address).some(Boolean) ? address : undefined; }
function editorToDraft(state: EditorState): PropertyDraft { return { canonicalName: state.canonicalName.trim(), propertyType: state.propertyType, ...(state.propertyType === "CUSTOM" && state.customPropertyType.trim() ? { customPropertyType: state.customPropertyType.trim() } : {}), availabilityStatus: state.availabilityStatus, ...(optionalText(state.jurisdiction) ? { jurisdiction: optionalText(state.jurisdiction) } : {}), ...(addressFromEditor(state) ? { address: addressFromEditor(state) } : {}), parcelIds: parcelValues(state.parcelIds), ...(optionalText(state.ownerOrganizationId) ? { ownerOrganizationId: optionalText(state.ownerOrganizationId) } : {}), ...(optionalText(state.brokerOrganizationId) ? { brokerOrganizationId: optionalText(state.brokerOrganizationId) } : {}), ...(optionalText(state.economicDevelopmentContactId) ? { economicDevelopmentContactId: optionalText(state.economicDevelopmentContactId) } : {}) }; }
function editorToPatch(state: EditorState) { return { canonicalName: state.canonicalName.trim(), propertyType: state.propertyType, customPropertyType: state.propertyType === "CUSTOM" ? optionalText(state.customPropertyType) ?? null : null, availabilityStatus: state.availabilityStatus, jurisdiction: optionalText(state.jurisdiction) ?? null, address: addressFromEditor(state) ?? null, parcelIds: parcelValues(state.parcelIds), ownerOrganizationId: optionalText(state.ownerOrganizationId) ?? null, brokerOrganizationId: optionalText(state.brokerOrganizationId) ?? null, economicDevelopmentContactId: optionalText(state.economicDevelopmentContactId) ?? null }; }
function buildFilterParams(filters: PropertyRegistryFilters) { const params = new URLSearchParams(); if (filters.query) params.set("q", filters.query); if (filters.propertyType) params.set("propertyType", filters.propertyType); if (filters.availabilityStatus) params.set("availabilityStatus", filters.availabilityStatus); if (filters.readinessState) params.set("readinessState", filters.readinessState); if (filters.verificationStatus) params.set("verificationStatus", filters.verificationStatus); if (filters.projectId) params.set("projectId", filters.projectId); return params.toString(); }
