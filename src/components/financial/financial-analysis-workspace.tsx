"use client";

import { useMemo, useState } from "react";
import type {
  CandidateFinancialInput,
  CostAssumptionInput,
  FinancialAnalysisRequest,
  FinancialAnalysisResponse,
  FinancialPersistenceStatus,
  FinancialWorkspaceLoadResponse,
  FinancialWorkspaceSaveResponse,
  IncentiveProgramInput,
  NegotiationEventInput,
  PersistedFinancialVersion,
  ProjectIncentiveInput,
  ProvenanceInput,
} from "@/domains/financial-analysis/contracts";
import styles from "./financial-analysis.module.css";

const costCategories = [
  "LABOR", "PAYROLL_BURDEN", "REAL_ESTATE", "CONSTRUCTION", "ELECTRICITY",
  "NATURAL_GAS", "WATER", "WASTEWATER", "TELECOMMUNICATIONS", "TRANSPORTATION",
  "PROPERTY_TAX", "SALES_USE_TAX", "CORPORATE_TAX", "INSURANCE", "PERMITTING",
  "OCCUPANCY", "CUSTOM",
] as const;
const costBehaviors = [
  "ONE_TIME", "RECURRING_FIXED", "RECURRING_VARIABLE", "HEADCOUNT_DEPENDENT",
  "VOLUME_DEPENDENT", "CAPITAL_DEPENDENT", "TAX_BASE_DEPENDENT", "CUSTOM_RESOLVED",
] as const;
const sourceTypes = [
  "OBSERVATION", "DOCUMENT", "CONSULTANT_ASSUMPTION", "CLIENT_ASSUMPTION", "PROGRAM_AUTHORITY", "OTHER",
] as const;
const confidenceValues = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
const incentiveTypes = [
  "CASH_GRANT", "TAX_CREDIT", "TAX_ABATEMENT", "TRAINING_REIMBURSEMENT", "INFRASTRUCTURE_GRANT",
  "FEE_WAIVER", "PROPERTY_TAX_ARRANGEMENT", "UTILITY_SUPPORT", "OTHER",
] as const;
const incentiveStatuses = [
  "IDENTIFIED", "REQUESTED", "OFFERED", "NEGOTIATED", "APPROVED", "EARNED", "RECEIVED", "AT_RISK", "EXPIRED",
] as const;
const negotiationTypes = ["ASK", "OFFER", "COUNTEROFFER", "COMMITMENT", "CONDITION", "DEADLINE", "NOTE"] as const;
const tabs = ["Costs", "Comparison", "Incentives", "Negotiation", "Calculation detail", "Version history"] as const;

type Tab = (typeof tabs)[number];
type DraftIncentive = Omit<ProjectIncentiveInput, "type" | "status" | "benefitSchedule"> & {
  type: "" | ProjectIncentiveInput["type"];
  status: "" | ProjectIncentiveInput["status"];
  scheduleText: string;
};
type DraftProgram = Omit<IncentiveProgramInput, "classification"> & {
  classification: "" | IncentiveProgramInput["classification"];
};
type CandidateDraft = Omit<CandidateFinancialInput, "incentives"> & {
  localId: string;
  incentives: DraftIncentive[];
};
type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: { message?: string; code?: string } };

function localId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankProvenance(): ProvenanceInput {
  return { sourceId: "", sourceType: "CONSULTANT_ASSUMPTION", confidence: "UNKNOWN" };
}

function blankCandidate(local = localId("candidate")): CandidateDraft {
  return {
    localId: local,
    candidateId: "",
    label: "",
    version: 1,
    employeeCount: "",
    productionUnits: "",
    assumptions: [],
    incentives: [],
    negotiations: [],
  };
}

function blankAssumption(): CostAssumptionInput {
  return {
    id: localId("cost"),
    category: "CUSTOM",
    behavior: "RECURRING_VARIABLE",
    label: "",
    baseAmount: "",
    quantity: "",
    quantityUnit: "",
    unitCost: "",
    unitCostUnit: "",
    startsInYear: 0,
    escalationRate: "",
    required: true,
    provenance: blankProvenance(),
  };
}

function blankProgram(): DraftProgram {
  return {
    id: localId("program"),
    name: "",
    jurisdiction: "",
    authority: "",
    classification: "",
    eligibilitySummary: "",
    deadline: "",
    requirements: "",
    clawbacks: "",
    provenance: { sourceId: "", sourceType: "PROGRAM_AUTHORITY", confidence: "UNKNOWN" },
  };
}

function blankIncentive(): DraftIncentive {
  return {
    id: localId("incentive"),
    programId: "",
    name: "",
    type: "",
    status: "",
    nominalAmount: "",
    estimatedRealizableAmount: "",
    probability: "",
    actualReceivedAmount: "",
    scheduleText: "",
    provenance: { sourceId: "", sourceType: "PROGRAM_AUTHORITY", confidence: "UNKNOWN" },
  };
}

function blankNegotiation(): NegotiationEventInput {
  return {
    id: localId("negotiation"),
    incentiveId: "",
    type: "NOTE",
    at: "",
    party: "",
    amount: "",
    responseDeadline: "",
    description: "",
    visibility: "INTERNAL",
  };
}

function labelFor(value: string): string {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCents(value: string | undefined, currency: string): string {
  if (value === undefined) return "—";
  const cents = BigInt(value);
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  const whole = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  const prefix = currency === "USD" ? "$" : `${currency} `;
  return `${negative ? "−" : ""}${prefix}${whole}.${fraction}`;
}

function parseSchedule(text: string, name: string): ProjectIncentiveInput["benefitSchedule"] {
  if (!text.trim()) return [];
  return text.split(",").map((part) => {
    const pieces = part.split(":");
    if (pieces.length !== 2) throw new Error(`${name || "Incentive"} schedule must use year:share pairs such as 0:0.5,1:0.5.`);
    const yearIndex = Number(pieces[0]?.trim());
    const share = pieces[1]?.trim() ?? "";
    if (!Number.isInteger(yearIndex) || yearIndex < 0 || !share) throw new Error(`${name || "Incentive"} has an invalid benefit schedule.`);
    return { yearIndex, share };
  });
}

function scheduleText(schedule: ProjectIncentiveInput["benefitSchedule"]): string {
  return schedule.map((entry) => `${entry.yearIndex}:${entry.share}`).join(",");
}

function localDateTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string): string {
  if (!value.trim()) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Negotiation date/time is invalid.");
  return date.toISOString();
}

function hydrateCandidate(candidate: CandidateFinancialInput): CandidateDraft {
  return {
    ...candidate,
    localId: localId("candidate"),
    incentives: candidate.incentives.map((item) => ({
      ...item,
      scheduleText: scheduleText(item.benefitSchedule),
    })),
    negotiations: candidate.negotiations.map((event) => ({ ...event, at: localDateTime(event.at) })),
  };
}

function hydratePrograms(programs: IncentiveProgramInput[]): DraftProgram[] {
  return programs.map((program) => ({ ...program, classification: program.classification }));
}

function isBlankNegotiation(event: NegotiationEventInput): boolean {
  return [event.at, event.party, event.amount, event.responseDeadline, event.description, event.incentiveId]
    .every((value) => (value ?? "").trim().length === 0);
}

async function apiData<T>(response: Response): Promise<T> {
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? "Request failed." : payload.error.message || payload.error.code || "Request failed.");
  }
  return payload.data;
}

export function FinancialAnalysisWorkspace({ persistence: initialPersistence }: { persistence: FinancialPersistenceStatus }) {
  const [persistence, setPersistence] = useState(initialPersistence);
  const [projectId, setProjectId] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [baseYear, setBaseYear] = useState(String(new Date().getFullYear()));
  const [horizonYears, setHorizonYears] = useState("10");
  const [discountRate, setDiscountRate] = useState("");
  const [incentiveTreatment, setIncentiveTreatment] = useState<FinancialAnalysisRequest["incentiveTreatment"]>("PROBABILITY_ADJUSTED");
  const [baselineCandidateId, setBaselineCandidateId] = useState("");
  const [candidates, setCandidates] = useState<CandidateDraft[]>([blankCandidate("candidate-1")]);
  const [selectedCandidateLocalId, setSelectedCandidateLocalId] = useState("candidate-1");
  const [programs, setPrograms] = useState<DraftProgram[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Costs");
  const [analysis, setAnalysis] = useState<FinancialAnalysisResponse | null>(null);
  const [history, setHistory] = useState<PersistedFinancialVersion[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCandidate = candidates.find((candidate) => candidate.localId === selectedCandidateLocalId) ?? candidates[0];
  const selectedResult = selectedCandidate
    ? analysis?.results.find((result) => result.candidateId === selectedCandidate.candidateId)
    : undefined;
  const selectedValuations = selectedCandidate
    ? analysis?.incentiveValuations.find((entry) => entry.candidateId === selectedCandidate.candidateId)?.valuations ?? []
    : [];
  const selectedVariance = selectedCandidate
    ? analysis?.variances.find((entry) => entry.candidateId === selectedCandidate.candidateId)?.lines ?? []
    : [];
  const selectedLedger = selectedCandidate
    ? analysis?.sourceLedger.find((entry) => entry.candidateId === selectedCandidate.candidateId)
    : undefined;
  const candidateOptions = useMemo(() => candidates.filter((candidate) => candidate.candidateId.trim()), [candidates]);

  function updateSelectedCandidate(patch: Partial<CandidateDraft>) {
    if (!selectedCandidate) return;
    setCandidates((current) => current.map((candidate) => candidate.localId === selectedCandidate.localId ? { ...candidate, ...patch } : candidate));
  }

  function updateAssumption(id: string, patch: Partial<CostAssumptionInput>) {
    if (!selectedCandidate) return;
    updateSelectedCandidate({ assumptions: selectedCandidate.assumptions.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function updateAssumptionProvenance(id: string, patch: Partial<ProvenanceInput>) {
    if (!selectedCandidate) return;
    updateSelectedCandidate({ assumptions: selectedCandidate.assumptions.map((item) => item.id === id ? { ...item, provenance: { ...item.provenance, ...patch } } : item) });
  }

  function updateIncentive(id: string, patch: Partial<DraftIncentive>) {
    if (!selectedCandidate) return;
    updateSelectedCandidate({ incentives: selectedCandidate.incentives.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function updateIncentiveProvenance(id: string, patch: Partial<ProvenanceInput>) {
    if (!selectedCandidate) return;
    updateSelectedCandidate({ incentives: selectedCandidate.incentives.map((item) => item.id === id ? { ...item, provenance: { ...item.provenance, ...patch } } : item) });
  }

  function updateNegotiation(id: string, patch: Partial<NegotiationEventInput>) {
    if (!selectedCandidate) return;
    updateSelectedCandidate({ negotiations: selectedCandidate.negotiations.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function buildRequest(): FinancialAnalysisRequest {
    const mappedCandidates: CandidateFinancialInput[] = candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      ...(candidate.label?.trim() ? { label: candidate.label.trim() } : {}),
      version: candidate.version,
      ...(candidate.employeeCount?.trim() ? { employeeCount: candidate.employeeCount.trim() } : {}),
      ...(candidate.productionUnits?.trim() ? { productionUnits: candidate.productionUnits.trim() } : {}),
      assumptions: candidate.assumptions,
      incentives: candidate.incentives.map((item) => {
        if (!item.type) throw new Error(`${item.name || "Incentive"} type is required.`);
        if (!item.status) throw new Error(`${item.name || "Incentive"} status is required.`);
        return {
          id: item.id,
          programId: item.programId,
          name: item.name,
          type: item.type,
          status: item.status,
          nominalAmount: item.nominalAmount,
          estimatedRealizableAmount: item.estimatedRealizableAmount,
          probability: item.probability,
          actualReceivedAmount: item.actualReceivedAmount,
          benefitSchedule: parseSchedule(item.scheduleText, item.name),
          provenance: item.provenance,
          visibility: item.visibility,
        };
      }),
      negotiations: candidate.negotiations.filter((event) => !isBlankNegotiation(event)).map((event) => ({ ...event, at: toIso(event.at) })),
    }));

    return {
      projectId,
      scenarioId,
      currency,
      baseYear: Number(baseYear),
      horizonYears: Number(horizonYears),
      discountRate,
      incentiveTreatment,
      ...(baselineCandidateId.trim() ? { baselineCandidateId } : {}),
      candidates: mappedCandidates,
    };
  }

  function buildPrograms(): IncentiveProgramInput[] {
    return programs.map((program) => {
      if (!program.classification) throw new Error(`${program.name || "Incentive program"} classification is required.`);
      return { ...program, classification: program.classification };
    });
  }

  function applySavedAnalysis(request: FinancialAnalysisRequest, calculated: FinancialAnalysisResponse) {
    const hydrated = request.candidates.map(hydrateCandidate);
    setProjectId(request.projectId);
    setScenarioId(request.scenarioId);
    setCurrency(request.currency);
    setBaseYear(String(request.baseYear));
    setHorizonYears(String(request.horizonYears));
    setDiscountRate(request.discountRate);
    setIncentiveTreatment(request.incentiveTreatment);
    setBaselineCandidateId(request.baselineCandidateId ?? "");
    setCandidates(hydrated.length ? hydrated : [blankCandidate()]);
    setSelectedCandidateLocalId(hydrated[0]?.localId ?? "candidate-1");
    setAnalysis(calculated);
  }

  async function calculate() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/financial-analysis/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildRequest()),
      });
      const calculated = await apiData<FinancialAnalysisResponse>(response);
      setAnalysis(calculated);
      setMessage("Financial analysis recalculated from the current assumptions.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Financial analysis could not be calculated.");
    } finally { setBusy(false); }
  }

  async function loadSaved() {
    setBusy(true); setError(null); setMessage(null);
    try {
      if (!projectId.trim() || !scenarioId.trim()) throw new Error("Project ID and scenario ID are required to load saved financial analysis.");
      const query = new URLSearchParams({ projectId: projectId.trim(), scenarioId: scenarioId.trim() });
      const response = await fetch(`/api/v1/financial-analysis/workspaces?${query.toString()}`, { method: "GET" });
      const loaded = await apiData<FinancialWorkspaceLoadResponse>(response);
      setPersistence(loaded.persistence);
      setPrograms(hydratePrograms(loaded.incentivePrograms));
      setHistory(loaded.versions);
      if (!loaded.analysis || !loaded.calculated) {
        setAnalysis(null);
        setMessage("No saved financial version exists for this project and scenario yet.");
        return;
      }
      applySavedAnalysis(loaded.analysis, loaded.calculated);
      setMessage("Loaded the latest authoritative financial version for each candidate.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Saved financial analysis could not be loaded.");
    } finally { setBusy(false); }
  }

  async function saveVersion() {
    setBusy(true); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/financial-analysis/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysis: buildRequest(), incentivePrograms: buildPrograms() }),
      });
      const saved = await apiData<FinancialWorkspaceSaveResponse>(response);
      setPersistence(saved.persistence);
      setPrograms(hydratePrograms(saved.incentivePrograms));
      setHistory((current) => [...saved.versions, ...current.filter((row) => !saved.versions.some((savedRow) => savedRow.contentHash === row.contentHash))]);
      applySavedAnalysis(saved.analysis, saved.calculated);
      setMessage(`Saved ${saved.versions.length} authoritative candidate financial version${saved.versions.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Financial workspace could not be saved.");
    } finally { setBusy(false); }
  }

  function addCandidate() {
    const candidate = blankCandidate();
    setCandidates((current) => [...current, candidate]);
    setSelectedCandidateLocalId(candidate.localId);
    setAnalysis(null);
  }

  function removeCandidate(local: string) {
    setCandidates((current) => {
      if (current.length === 1) return current;
      const next = current.filter((candidate) => candidate.localId !== local);
      if (selectedCandidateLocalId === local && next[0]) setSelectedCandidateLocalId(next[0].localId);
      return next;
    });
    setAnalysis(null);
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.persistenceStrip} data-ready={persistence.configured && persistence.durable}>
        <strong>{persistence.configured && persistence.durable ? "Project save ready" : "Calculation only"}</strong>
        <span>{persistence.message}</span>
      </div>

      <div className={styles.contextGrid}>
        <label>Project ID<input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="Required" /></label>
        <label>Scenario ID<input value={scenarioId} onChange={(event) => setScenarioId(event.target.value)} placeholder="Required" /></label>
        <label>Currency<input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} /></label>
        <label>Base year<input inputMode="numeric" value={baseYear} onChange={(event) => setBaseYear(event.target.value)} /></label>
        <label>Horizon<input inputMode="numeric" value={horizonYears} onChange={(event) => setHorizonYears(event.target.value)} /><span className={styles.unit}>years</span></label>
        <label>Discount rate<input inputMode="decimal" value={discountRate} onChange={(event) => setDiscountRate(event.target.value)} placeholder="e.g. 0.07" /></label>
        <label>Incentive treatment<select value={incentiveTreatment} onChange={(event) => setIncentiveTreatment(event.target.value as FinancialAnalysisRequest["incentiveTreatment"])}><option value="NONE">None</option><option value="NOMINAL">Nominal</option><option value="REALIZABLE">Realizable</option><option value="PROBABILITY_ADJUSTED">Probability adjusted</option></select></label>
        <label>Baseline candidate<select value={baselineCandidateId} onChange={(event) => setBaselineCandidateId(event.target.value)}><option value="">Select baseline</option>{candidateOptions.map((candidate) => <option key={candidate.localId} value={candidate.candidateId}>{candidate.label || candidate.candidateId}</option>)}</select></label>
      </div>

      <div className={styles.actionRow}>
        <button className="button button-primary" type="button" onClick={calculate} disabled={busy}>{busy ? "Working…" : "Recalculate"}</button>
        <button className="button button-secondary" type="button" onClick={loadSaved} disabled={busy}>Load saved</button>
        <button className="button button-secondary" type="button" onClick={saveVersion} disabled={busy || !persistence.durable}>Save version</button>
        <span className={styles.engineNote}>Totals and comparisons recalculate from the assumptions shown here.</span>
      </div>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      {message ? <div className={styles.success} role="status">{message}</div> : null}
      {analysis?.warnings.length ? <div className={styles.warning}>{analysis.warnings.join(" ")}</div> : null}

      <div className={styles.candidateBar}>
        <div className={styles.candidateTabs}>
          {candidates.map((candidate, index) => (
            <button type="button" key={candidate.localId} className={candidate.localId === selectedCandidate?.localId ? styles.candidateActive : styles.candidateButton} onClick={() => setSelectedCandidateLocalId(candidate.localId)}>
              {candidate.label || candidate.candidateId || `Candidate ${index + 1}`}
              {analysis?.results.find((result) => result.candidateId === candidate.candidateId)?.status === "INCOMPLETE" ? " · Incomplete" : ""}
            </button>
          ))}
        </div>
        <button className="button button-secondary" type="button" onClick={addCandidate}>Add candidate</button>
      </div>

      {selectedCandidate ? <div className={styles.candidateIdentity}>
        <label>Candidate ID<input value={selectedCandidate.candidateId} onChange={(event) => updateSelectedCandidate({ candidateId: event.target.value })} placeholder="Required" /></label>
        <label>Display label<input value={selectedCandidate.label ?? ""} onChange={(event) => updateSelectedCandidate({ label: event.target.value })} /></label>
        <label>Version<input value={`v${selectedCandidate.version}`} readOnly aria-label="Current model version" /></label>
        <label>Employees<input inputMode="decimal" value={selectedCandidate.employeeCount ?? ""} onChange={(event) => updateSelectedCandidate({ employeeCount: event.target.value })} /></label>
        <label>Production units<input inputMode="decimal" value={selectedCandidate.productionUnits ?? ""} onChange={(event) => updateSelectedCandidate({ productionUnits: event.target.value })} /></label>
        {candidates.length > 1 ? <button className={styles.removeButton} type="button" onClick={() => removeCandidate(selectedCandidate.localId)}>Remove candidate</button> : null}
      </div> : null}

      <div className={styles.tabBar} role="tablist" aria-label="Financial analysis views">
        {tabs.map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? styles.tabActive : styles.tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>

      {activeTab === "Costs" && selectedCandidate ? <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Operating cost assumptions</h2><p>Blank required quantities or rates stay missing and make the candidate incomplete rather than zero-cost.</p></div><button className="button button-secondary" type="button" onClick={() => updateSelectedCandidate({ assumptions: [...selectedCandidate.assumptions, blankAssumption()] })}>Add assumption</button></div>
        <div className={styles.tableWrap}><table className={styles.editableTable}><thead><tr><th>Category</th><th>Label</th><th>Behavior</th><th>Quantity</th><th>Unit</th><th>Rate / amount</th><th>Rate unit</th><th>Start</th><th>End</th><th>Escalation</th><th>Source</th><th>Source type</th><th>Confidence</th><th>Required</th><th /></tr></thead><tbody>
          {selectedCandidate.assumptions.length === 0 ? <tr><td colSpan={15} className={styles.emptyCell}>No cost assumptions entered.</td></tr> : selectedCandidate.assumptions.map((item) => {
            const unitDriven = ["RECURRING_VARIABLE", "HEADCOUNT_DEPENDENT", "VOLUME_DEPENDENT"].includes(item.behavior);
            return <tr key={item.id}>
              <td><select value={item.category} onChange={(event) => updateAssumption(item.id, { category: event.target.value as CostAssumptionInput["category"] })}>{costCategories.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></td>
              <td><input value={item.label} onChange={(event) => updateAssumption(item.id, { label: event.target.value })} /></td>
              <td><select value={item.behavior} onChange={(event) => updateAssumption(item.id, { behavior: event.target.value as CostAssumptionInput["behavior"] })}>{costBehaviors.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></td>
              <td><input inputMode="decimal" value={item.quantity ?? ""} onChange={(event) => updateAssumption(item.id, { quantity: event.target.value })} /></td>
              <td><input value={item.quantityUnit ?? ""} onChange={(event) => updateAssumption(item.id, { quantityUnit: event.target.value })} /></td>
              <td><input inputMode="decimal" value={unitDriven ? item.unitCost ?? "" : item.baseAmount ?? ""} onChange={(event) => unitDriven ? updateAssumption(item.id, { unitCost: event.target.value }) : updateAssumption(item.id, { baseAmount: event.target.value })} /></td>
              <td><input value={item.unitCostUnit ?? ""} onChange={(event) => updateAssumption(item.id, { unitCostUnit: event.target.value })} /></td>
              <td><input type="number" min="0" value={item.startsInYear} onChange={(event) => updateAssumption(item.id, { startsInYear: Number(event.target.value) })} /></td>
              <td><input type="number" min="0" value={item.endsInYear ?? ""} onChange={(event) => updateAssumption(item.id, { endsInYear: event.target.value === "" ? undefined : Number(event.target.value) })} /></td>
              <td><input inputMode="decimal" value={item.escalationRate ?? ""} onChange={(event) => updateAssumption(item.id, { escalationRate: event.target.value })} placeholder="0.03" /></td>
              <td><input value={item.provenance.sourceId} onChange={(event) => updateAssumptionProvenance(item.id, { sourceId: event.target.value })} /></td>
              <td><select value={item.provenance.sourceType} onChange={(event) => updateAssumptionProvenance(item.id, { sourceType: event.target.value as ProvenanceInput["sourceType"] })}>{sourceTypes.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></td>
              <td><select value={item.provenance.confidence} onChange={(event) => updateAssumptionProvenance(item.id, { confidence: event.target.value as ProvenanceInput["confidence"] })}>{confidenceValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></td>
              <td><input type="checkbox" checked={item.required} onChange={(event) => updateAssumption(item.id, { required: event.target.checked })} /></td>
              <td><button className={styles.iconButton} type="button" onClick={() => updateSelectedCandidate({ assumptions: selectedCandidate.assumptions.filter((row) => row.id !== item.id) })}>×</button></td>
            </tr>;
          })}
        </tbody></table></div>
      </section> : null}

      {activeTab === "Comparison" ? <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Candidate financial comparison</h2><p>Only calculated candidates rank. Baseline differential uses net present financial burden.</p></div></div>
        <div className={styles.tableWrap}><table><thead><tr><th>Candidate</th><th>Status</th><th>Year 1</th><th>5-year</th><th>10-year</th><th>{horizonYears || "Custom"}-year NPV</th><th>PV costs</th><th>PV incentives</th><th>Rank</th><th>Baseline differential</th></tr></thead><tbody>
          {candidates.map((candidate, index) => {
            const result = analysis?.results.find((item) => item.candidateId === candidate.candidateId);
            const comparison = analysis?.comparison.find((item) => item.candidateId === candidate.candidateId);
            const one = result?.summaries.find((item) => item.years === 1);
            const five = result?.summaries.find((item) => item.years === 5);
            const ten = result?.summaries.find((item) => item.years === 10);
            const horizon = result?.summaries.find((item) => item.years === Number(horizonYears));
            return <tr key={candidate.localId}><td><strong>{candidate.label || candidate.candidateId || `Candidate ${index + 1}`}</strong></td><td>{result?.status ?? "Not calculated"}{result?.missingInputs.length ? <span className={styles.subtle}> · {result.missingInputs.join("; ")}</span> : null}</td><td>{formatCents(one?.netNominalCents, currency)}</td><td>{formatCents(five?.netNominalCents, currency)}</td><td>{formatCents(ten?.netNominalCents, currency)}</td><td>{formatCents(horizon?.netPresentValueCents ?? result?.netPresentValueCents, currency)}</td><td>{formatCents(result?.totalPresentValueCostCents, currency)}</td><td>{formatCents(result?.totalPresentValueIncentiveCents, currency)}</td><td>{comparison?.rank ?? "—"}</td><td>{formatCents(comparison?.baselineDifferentialCents, currency)}</td></tr>;
          })}
        </tbody></table></div>
        {analysis?.comparisonMessage ? <p className={styles.inlineNote}>{analysis.comparisonMessage}</p> : null}
        {selectedVariance.length ? <><div className={styles.subhead}>Variance detail · {selectedCandidate?.label || selectedCandidate?.candidateId}</div><div className={styles.tableWrap}><table><thead><tr><th>Category</th><th>Candidate PV</th><th>Baseline PV</th><th>Differential</th></tr></thead><tbody>{selectedVariance.map((line) => <tr key={line.category}><td>{labelFor(line.category)}</td><td>{formatCents(line.candidateCents, currency)}</td><td>{formatCents(line.baselineCents, currency)}</td><td>{formatCents(line.differentialCents, currency)}</td></tr>)}</tbody></table></div></> : null}
      </section> : null}

      {activeTab === "Incentives" && selectedCandidate ? <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Incentive registry</h2><p>Programs describe potential tools; a project offer exists only when entered as a sourced project incentive.</p></div><button className="button button-secondary" type="button" onClick={() => setPrograms((current) => [...current, blankProgram()])}>Add program</button></div>
        <div className={styles.tableWrap}><table className={styles.editableTable}><thead><tr><th>Program ID</th><th>Program</th><th>Jurisdiction</th><th>Authority</th><th>Class</th><th>Eligibility</th><th>Deadline</th><th>Source</th><th>Confidence</th><th /></tr></thead><tbody>
          {programs.length === 0 ? <tr><td colSpan={10} className={styles.emptyCell}>No incentive programs entered.</td></tr> : programs.map((program) => <tr key={program.id}>
            <td><input value={program.id} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, id: event.target.value } : item))} /></td>
            <td><input value={program.name} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, name: event.target.value } : item))} /></td>
            <td><input value={program.jurisdiction} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, jurisdiction: event.target.value } : item))} /></td>
            <td><input value={program.authority} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, authority: event.target.value } : item))} /></td>
            <td><select value={program.classification} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, classification: event.target.value as DraftProgram["classification"] } : item))}><option value="">Select</option><option value="STATUTORY">Statutory</option><option value="DISCRETIONARY">Discretionary</option></select></td>
            <td><input value={program.eligibilitySummary} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, eligibilitySummary: event.target.value } : item))} /></td>
            <td><input type="date" value={program.deadline ?? ""} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, deadline: event.target.value } : item))} /></td>
            <td><input value={program.provenance.sourceId} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, provenance: { ...item.provenance, sourceId: event.target.value } } : item))} /></td>
            <td><select value={program.provenance.confidence} onChange={(event) => setPrograms((current) => current.map((item) => item.id === program.id ? { ...item, provenance: { ...item.provenance, confidence: event.target.value as ProvenanceInput["confidence"] } } : item))}>{confidenceValues.map((value) => <option key={value}>{value}</option>)}</select></td>
            <td><button className={styles.iconButton} type="button" onClick={() => setPrograms((current) => current.filter((item) => item.id !== program.id))}>×</button></td>
          </tr>)}
        </tbody></table></div>

        <div className={styles.panelHead}><div><h2>Project incentives · {selectedCandidate.label || selectedCandidate.candidateId || "candidate"}</h2><p>Unknown award values stay blank and are excluded from valuation until sourced.</p></div><button className="button button-secondary" type="button" onClick={() => updateSelectedCandidate({ incentives: [...selectedCandidate.incentives, blankIncentive()] })}>Add project incentive</button></div>
        <div className={styles.tableWrap}><table className={styles.editableTable}><thead><tr><th>Program</th><th>Name</th><th>Type</th><th>Status</th><th>Nominal</th><th>Realizable</th><th>Probability</th><th>Actual received</th><th>Schedule</th><th>Source</th><th>Confidence</th><th>Prob-adjusted</th><th>PV</th><th /></tr></thead><tbody>
          {selectedCandidate.incentives.length === 0 ? <tr><td colSpan={14} className={styles.emptyCell}>No project incentives entered.</td></tr> : selectedCandidate.incentives.map((item) => {
            const valuation = selectedValuations.find((entry) => entry.incentiveId === item.id);
            return <tr key={item.id}>
              <td><select value={item.programId} onChange={(event) => updateIncentive(item.id, { programId: event.target.value })}><option value="">Select program</option>{programs.map((program) => <option key={program.id} value={program.id}>{program.name || program.id}</option>)}</select></td>
              <td><input value={item.name} onChange={(event) => updateIncentive(item.id, { name: event.target.value })} /></td>
              <td><select value={item.type} onChange={(event) => updateIncentive(item.id, { type: event.target.value as DraftIncentive["type"] })}><option value="">Select</option>{incentiveTypes.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></td>
              <td><select value={item.status} onChange={(event) => updateIncentive(item.id, { status: event.target.value as DraftIncentive["status"] })}><option value="">Select</option>{incentiveStatuses.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></td>
              <td><input inputMode="decimal" value={item.nominalAmount ?? ""} onChange={(event) => updateIncentive(item.id, { nominalAmount: event.target.value })} /></td>
              <td><input inputMode="decimal" value={item.estimatedRealizableAmount ?? ""} onChange={(event) => updateIncentive(item.id, { estimatedRealizableAmount: event.target.value })} /></td>
              <td><input inputMode="decimal" value={item.probability ?? ""} onChange={(event) => updateIncentive(item.id, { probability: event.target.value })} placeholder="0–1" /></td>
              <td><input inputMode="decimal" value={item.actualReceivedAmount ?? ""} onChange={(event) => updateIncentive(item.id, { actualReceivedAmount: event.target.value })} /></td>
              <td><input value={item.scheduleText} onChange={(event) => updateIncentive(item.id, { scheduleText: event.target.value })} placeholder="0:0.5,1:0.5" /></td>
              <td><input value={item.provenance.sourceId} onChange={(event) => updateIncentiveProvenance(item.id, { sourceId: event.target.value })} /></td>
              <td><select value={item.provenance.confidence} onChange={(event) => updateIncentiveProvenance(item.id, { confidence: event.target.value as ProvenanceInput["confidence"] })}>{confidenceValues.map((value) => <option key={value}>{value}</option>)}</select></td>
              <td>{formatCents(valuation?.probabilityAdjustedCents, currency)}</td><td>{formatCents(valuation?.presentValueCents, currency)}</td>
              <td><button className={styles.iconButton} type="button" onClick={() => updateSelectedCandidate({ incentives: selectedCandidate.incentives.filter((row) => row.id !== item.id) })}>×</button></td>
            </tr>;
          })}
        </tbody></table></div>
      </section> : null}

      {activeTab === "Negotiation" && selectedCandidate ? <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Negotiation tracking · {selectedCandidate.label || selectedCandidate.candidateId || "candidate"}</h2><p>Asks, offers, counteroffers, commitments, conditions and deadlines are retained as append-only events when saved.</p></div><button className="button button-secondary" type="button" onClick={() => updateSelectedCandidate({ negotiations: [...selectedCandidate.negotiations, blankNegotiation()] })}>Add event</button></div>
        <div className={styles.tableWrap}><table className={styles.editableTable}><thead><tr><th>Type</th><th>Date / time</th><th>Incentive</th><th>Party</th><th>Amount</th><th>Response deadline</th><th>Description</th><th /></tr></thead><tbody>
          {selectedCandidate.negotiations.length === 0 ? <tr><td colSpan={8} className={styles.emptyCell}>No negotiation events entered.</td></tr> : selectedCandidate.negotiations.map((event) => <tr key={event.id}>
            <td><select value={event.type} onChange={(change) => updateNegotiation(event.id, { type: change.target.value as NegotiationEventInput["type"] })}>{negotiationTypes.map((value) => <option key={value} value={value}>{labelFor(value)}</option>)}</select></td>
            <td><input type="datetime-local" value={event.at} onChange={(change) => updateNegotiation(event.id, { at: change.target.value })} /></td>
            <td><select value={event.incentiveId ?? ""} onChange={(change) => updateNegotiation(event.id, { incentiveId: change.target.value })}><option value="">General</option>{selectedCandidate.incentives.map((item) => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}</select></td>
            <td><input value={event.party ?? ""} onChange={(change) => updateNegotiation(event.id, { party: change.target.value })} /></td>
            <td><input inputMode="decimal" value={event.amount ?? ""} onChange={(change) => updateNegotiation(event.id, { amount: change.target.value })} /></td>
            <td><input type="date" value={event.responseDeadline ?? ""} onChange={(change) => updateNegotiation(event.id, { responseDeadline: change.target.value })} /></td>
            <td><input value={event.description} onChange={(change) => updateNegotiation(event.id, { description: change.target.value })} /></td>
            <td><button className={styles.iconButton} type="button" onClick={() => updateSelectedCandidate({ negotiations: selectedCandidate.negotiations.filter((row) => row.id !== event.id) })}>×</button></td>
          </tr>)}
        </tbody></table></div>
      </section> : null}

      {activeTab === "Calculation detail" ? <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Calculation detail</h2><p>Inspect the engine cash-flow lines that roll into totals; costs and incentives remain separate.</p></div></div>
        {selectedResult ? <><div className={styles.summaryStrip}><span>Status <strong>{selectedResult.status}</strong></span><span>Nominal costs <strong>{formatCents(selectedResult.totalNominalCostCents, currency)}</strong></span><span>PV costs <strong>{formatCents(selectedResult.totalPresentValueCostCents, currency)}</strong></span><span>PV incentives <strong>{formatCents(selectedResult.totalPresentValueIncentiveCents, currency)}</strong></span><span>Net NPV <strong>{formatCents(selectedResult.netPresentValueCents, currency)}</strong></span></div><div className={styles.tableWrap}><table><thead><tr><th>Year</th><th>Kind</th><th>Category</th><th>Source line</th><th>Label</th><th>Nominal</th><th>Present value</th></tr></thead><tbody>{selectedResult.cashFlows.length === 0 ? <tr><td colSpan={7} className={styles.emptyCell}>No calculated cash flows.</td></tr> : selectedResult.cashFlows.map((flow, index) => <tr key={`${flow.sourceId}-${flow.yearIndex}-${index}`}><td>{flow.calendarYear}</td><td>{flow.kind}</td><td>{labelFor(flow.category)}</td><td><code>{flow.sourceId}</code></td><td>{flow.label}</td><td>{formatCents(flow.nominalCents, currency)}</td><td>{formatCents(flow.presentValueCents, currency)}</td></tr>)}</tbody></table></div>{selectedResult.missingInputs.length ? <div className={styles.warning}>Missing required inputs: {selectedResult.missingInputs.join("; ")}</div> : null}</> : <div className={styles.emptyState}>Recalculate to inspect the cash-flow lines behind totals.</div>}
      </section> : null}

      {activeTab === "Version history" ? <section className={styles.panel}>
        <div className={styles.panelHead}><div><h2>Version & provenance history</h2><p>Saved versions are server-numbered and immutable; current sources and confidence remain visible below.</p></div></div>
        <div className={styles.tableWrap}><table><thead><tr><th>Candidate</th><th>Scenario</th><th>Version</th><th>Saved</th><th>Status</th><th>Saved by</th><th>Snapshot hash</th></tr></thead><tbody>{history.length === 0 ? <tr><td colSpan={7} className={styles.emptyCell}>No saved versions loaded in this session.</td></tr> : history.map((row) => <tr key={`${row.candidateId}-${row.scenarioId}-${row.version}`}><td>{row.candidateId}</td><td>{row.scenarioId}</td><td>v{row.version}</td><td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.status}</td><td>{row.createdBy}</td><td><code className={styles.hash}>{row.contentHash}</code></td></tr>)}</tbody></table></div>
        <div className={styles.subhead}>Current source ledger · {selectedCandidate?.label || selectedCandidate?.candidateId || "candidate"}</div>
        <div className={styles.tableWrap}><table><thead><tr><th>Version</th><th>Kind</th><th>Record</th><th>Source</th><th>Source type</th><th>Confidence</th><th>Observation</th><th>Effective</th></tr></thead><tbody>{!selectedLedger || selectedLedger.entries.length === 0 ? <tr><td colSpan={8} className={styles.emptyCell}>No sourced assumptions or incentives in the latest calculation.</td></tr> : selectedLedger.entries.map((entry) => <tr key={`${entry.kind}-${entry.id}`}><td>v{selectedLedger.version}</td><td>{labelFor(entry.kind)}</td><td><code>{entry.id}</code></td><td>{entry.sourceId || "Missing"}</td><td>{labelFor(entry.sourceType)}</td><td>{entry.confidence}</td><td>{entry.observationDate || "—"}</td><td>{entry.effectiveDate || "—"}</td></tr>)}</tbody></table></div>
      </section> : null}
    </div>
  );
}
