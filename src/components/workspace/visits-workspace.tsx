"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type {
  CandidateStage,
  DueDiligenceCategory,
  DueDiligenceStatus,
  FindingType,
  ReadinessFactor,
  RiskCategory,
  RiskLikelihood,
  RiskSeverity,
  RiskStatus,
} from "../../../packages/domain-due-diligence/src/index";
import {
  addCandidateToWorkspace,
  addDueDiligenceItem,
  addFieldObservation,
  addFollowUpAction,
  addLocalEvidenceHook,
  addOpenQuestion,
  addReadinessAssessment,
  addSiteVisit,
  addSiteVisitStop,
  addVisitFinding,
  addWorkspaceRisk,
  candidateStageOrder,
  createEmptyDueDiligenceWorkspace,
  eliminateWorkspaceCandidate,
  evaluateCandidateAdvancement,
  parseDueDiligenceWorkspace,
  readinessDimensions,
  reinstateWorkspaceCandidate,
  setFollowUpDone,
  splitReferences,
  summarizeWorkspaceCandidate,
  transitionWorkspaceCandidate,
  updateWorkspaceDueDiligenceItem,
  updateWorkspaceRisk,
  workspaceStorageKey,
  type DueDiligenceWorkspaceState,
} from "@/domains/due-diligence/live-workspace";
import styles from "./visits-workspace.module.css";

const ACTIVE_TRANSITION_STAGES = candidateStageOrder.filter(
  (stage) => !["ELIMINATED", "WITHDRAWN", "ON_HOLD"].includes(stage),
);
const RISK_CATEGORIES: readonly RiskCategory[] = [
  "PROJECT",
  "MARKET",
  "PROPERTY",
  "COST",
  "INCENTIVE",
  "SCHEDULE",
  "UTILITY",
  "WORKFORCE",
  "ENVIRONMENTAL",
  "TRANSPORTATION",
  "PERMITTING",
  "OWNERSHIP",
  "OTHER",
];
const RISK_STATUSES: readonly RiskStatus[] = ["OPEN", "MITIGATING", "RESOLVED", "ACCEPTED", "REJECTED"];
const DILIGENCE_CATEGORIES: readonly DueDiligenceCategory[] = [
  "TITLE",
  "SURVEY",
  "ZONING",
  "ENVIRONMENTAL",
  "UTILITIES",
  "TRANSPORTATION",
  "GEOTECHNICAL",
  "PERMITTING",
  "INCENTIVES",
  "OWNERSHIP",
  "DEVELOPMENT_TIMING",
  "OTHER",
];
const DILIGENCE_STATUSES: readonly DueDiligenceStatus[] = [
  "NOT_STARTED",
  "REQUESTED",
  "IN_PROGRESS",
  "AWAITING_EVIDENCE",
  "RECEIVED",
  "UNDER_REVIEW",
  "SATISFIED",
  "ISSUE_FOUND",
  "NOT_APPLICABLE",
];
const FINDING_TYPES: readonly FindingType[] = ["POSITIVE", "CONCERN", "CONDITION", "UNKNOWN"];

type WorkspaceTab = "PIPELINE" | "RISKS" | "DILIGENCE" | "VISITS" | "FIELD";

type Notice = { kind: "info" | "error"; text: string } | null;

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function label(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function localDateTimeValue(iso?: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string): string {
  return value ? new Date(value).toISOString() : now();
}

function evidenceText(ids: readonly string[]): string {
  return ids.length ? ids.join(", ") : "—";
}

export function VisitsWorkspace({ initialProjectId }: { initialProjectId?: string }) {
  const [workspace, setWorkspace] = useState<DueDiligenceWorkspaceState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>("PIPELINE");
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [selectedRiskId, setSelectedRiskId] = useState<string>("");
  const [selectedVisitId, setSelectedVisitId] = useState<string>("");
  const [selectedStopId, setSelectedStopId] = useState<string>("");
  const [bootstrapProjectId, setBootstrapProjectId] = useState(initialProjectId ?? "");
  const [bootstrapProjectLabel, setBootstrapProjectLabel] = useState("");
  const [readinessDraft, setReadinessDraft] = useState<ReadinessFactor[]>([]);

  useEffect(() => {
    if (initialProjectId) {
      const raw = localStorage.getItem(workspaceStorageKey(initialProjectId));
      if (raw) {
        try {
          const restored = parseDueDiligenceWorkspace(raw);
          setWorkspace(restored);
          setSelectedCandidateId(restored.candidates[0]?.candidate.id ?? "");
          setSelectedVisitId(restored.visits[0]?.id ?? "");
        } catch {
          setNotice({ kind: "error", text: "The device-local Category 10 draft could not be read. No server record was changed." });
        }
      }
    }
    setHydrated(true);
  }, [initialProjectId]);

  function commit(next: DueDiligenceWorkspaceState, message?: string) {
    localStorage.setItem(workspaceStorageKey(next.projectId), JSON.stringify(next));
    setWorkspace(next);
    if (message) setNotice({ kind: "info", text: message });
  }

  function act(operation: () => DueDiligenceWorkspaceState, message?: string) {
    try {
      const next = operation();
      commit(next, message);
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "The operation could not be completed." });
    }
  }

  const selectedRecord = workspace?.candidates.find((item) => item.candidate.id === selectedCandidateId);
  const selectedRisk = selectedRecord?.risks.find((risk) => risk.id === selectedRiskId);
  const selectedVisit = workspace?.visits.find((visit) => visit.id === selectedVisitId);
  const selectedStop = workspace?.stops.find((stop) => stop.id === selectedStopId);
  const fieldCandidate = workspace?.candidates.find((item) => item.candidate.id === selectedStop?.candidateId);

  const candidateSummaries = useMemo(
    () => workspace?.candidates.map((item) => summarizeWorkspaceCandidate(workspace, item.candidate.id)) ?? [],
    [workspace],
  );

  if (!hydrated) {
    return <div className={styles.loading}>Loading field workspace…</div>;
  }

  if (!workspace) {
    return (
      <section className={styles.bootstrap} aria-labelledby="visits-bootstrap-title">
        <div>
          <span className={styles.kicker}>Project context required</span>
          <h2 id="visits-bootstrap-title">Open a project or start a device-local field draft</h2>
          <p>
            Category 10 records belong to an authoritative project. The hosted shell does not yet expose a project persistence adapter here,
            so local field mode stores only user-entered draft records on this device and never claims server synchronization.
          </p>
        </div>
        {notice ? <NoticeBanner notice={notice} /> : null}
        <form
          className={styles.bootstrapForm}
          onSubmit={(event) => {
            event.preventDefault();
            const projectId = bootstrapProjectId.trim() || id("local-project");
            const projectLabel = bootstrapProjectLabel.trim();
            if (!projectLabel) {
              setNotice({ kind: "error", text: "Enter a project name before starting a local field draft." });
              return;
            }
            const created = createEmptyDueDiligenceWorkspace({
              projectId,
              projectLabel,
              actorId: "device-field-user",
              occurredAt: now(),
            });
            commit(created, "Device-local Category 10 draft created. It has not been synchronized to an authoritative project store.");
          }}
        >
          <label>
            Project name
            <input value={bootstrapProjectLabel} onChange={(event) => setBootstrapProjectLabel(event.target.value)} placeholder="Client expansion project" />
          </label>
          <label>
            Project reference <span className={styles.optional}>(optional if not yet available)</span>
            <input value={bootstrapProjectId} onChange={(event) => setBootstrapProjectId(event.target.value)} placeholder="Project ID" />
          </label>
          <div className={styles.bootstrapActions}>
            <button className="button button-primary" type="submit">Start local field draft</button>
            <Link className="button button-secondary" href="/projects">Open Projects</Link>
          </div>
        </form>
      </section>
    );
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.localBanner} role="status">
        <strong>Device-local field draft</strong>
        <span>Changes are stored in this browser only. Evidence files are recorded as pending upload hooks; no server persistence is being claimed.</span>
      </div>
      {notice ? <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} /> : null}

      <div className={styles.contextBar}>
        <div>
          <span className={styles.kicker}>Current project</span>
          <strong>{workspace.projectLabel}</strong>
          <span className={styles.muted}>{workspace.projectId}</span>
        </div>
        <div className={styles.contextActions}>
          <span className={styles.syncBadge}>Local only</span>
          <button className="button button-secondary" type="button" onClick={() => setTab("FIELD")}>Field mode</button>
        </div>
      </div>

      <nav className={styles.tabs} aria-label="Due diligence workspace views">
        {(["PIPELINE", "RISKS", "DILIGENCE", "VISITS", "FIELD"] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? styles.tabActive : styles.tab} onClick={() => setTab(item)}>
            {item === "DILIGENCE" ? "Due diligence" : label(item)}
          </button>
        ))}
      </nav>

      {tab === "PIPELINE" ? (
        <PipelineView
          workspace={workspace}
          candidateSummaries={candidateSummaries}
          selectedCandidateId={selectedCandidateId}
          onSelectCandidate={(candidateId) => {
            setSelectedCandidateId(candidateId);
            setSelectedRiskId("");
          }}
          act={act}
        />
      ) : null}

      {tab === "RISKS" ? (
        <RiskView
          workspace={workspace}
          candidateId={selectedCandidateId}
          selectedRiskId={selectedRiskId}
          onSelectCandidate={(candidateId) => {
            setSelectedCandidateId(candidateId);
            setSelectedRiskId("");
          }}
          onSelectRisk={setSelectedRiskId}
          act={act}
        />
      ) : null}

      {tab === "DILIGENCE" ? (
        <DiligenceView
          workspace={workspace}
          candidateId={selectedCandidateId}
          onSelectCandidate={setSelectedCandidateId}
          readinessDraft={readinessDraft}
          setReadinessDraft={setReadinessDraft}
          act={act}
        />
      ) : null}

      {tab === "VISITS" ? (
        <VisitsPlanningView
          workspace={workspace}
          selectedVisitId={selectedVisitId}
          onSelectVisit={(visitId) => {
            setSelectedVisitId(visitId);
            setSelectedStopId("");
          }}
          act={act}
        />
      ) : null}

      {tab === "FIELD" ? (
        <FieldMode
          workspace={workspace}
          selectedVisitId={selectedVisitId}
          selectedStopId={selectedStopId}
          onSelectVisit={(visitId) => {
            setSelectedVisitId(visitId);
            const first = workspace.stops.filter((stop) => stop.siteVisitId === visitId).sort((a, b) => a.sequence - b.sequence)[0];
            setSelectedStopId(first?.id ?? "");
          }}
          onSelectStop={setSelectedStopId}
          candidate={fieldCandidate}
          act={act}
        />
      ) : null}
    </div>
  );
}

function NoticeBanner({ notice, onDismiss }: { notice: Exclude<Notice, null>; onDismiss?: () => void }) {
  return (
    <div className={notice.kind === "error" ? styles.errorNotice : styles.infoNotice} role={notice.kind === "error" ? "alert" : "status"}>
      <span>{notice.text}</span>
      {onDismiss ? <button type="button" onClick={onDismiss} aria-label="Dismiss message">×</button> : null}
    </div>
  );
}

function CandidateSelector({ workspace, value, onChange }: { workspace: DueDiligenceWorkspaceState; value: string; onChange: (id: string) => void }) {
  return (
    <label className={styles.compactLabel}>
      Candidate
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select candidate</option>
        {workspace.candidates.map((record) => (
          <option key={record.candidate.id} value={record.candidate.id}>{record.name} · {label(record.candidate.stage)}</option>
        ))}
      </select>
    </label>
  );
}

function PipelineView({
  workspace,
  candidateSummaries,
  selectedCandidateId,
  onSelectCandidate,
  act,
}: {
  workspace: DueDiligenceWorkspaceState;
  candidateSummaries: ReturnType<typeof summarizeWorkspaceCandidate>[];
  selectedCandidateId: string;
  onSelectCandidate: (id: string) => void;
  act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void;
}) {
  const selected = workspace.candidates.find((record) => record.candidate.id === selectedCandidateId);
  return (
    <div className={styles.view}>
      <div className={styles.viewHeader}>
        <div><span className={styles.kicker}>Candidate pipeline</span><h2>Progress candidates without losing history</h2></div>
        <AddCandidateForm workspace={workspace} act={act} onCreated={onSelectCandidate} />
      </div>

      <div className={styles.stageStrip} aria-label="Candidate stage counts">
        {candidateStageOrder.map((stage) => {
          const count = workspace.candidates.filter((item) => item.candidate.stage === stage).length;
          return <div className={styles.stageCell} key={stage}><span>{label(stage)}</span><strong>{count}</strong></div>;
        })}
      </div>

      {workspace.candidates.length === 0 ? (
        <EmptyRow title="No candidates in this draft" copy="Add a candidate when a market or property enters this project's evaluation pipeline. Nothing is pre-populated or marked complete." />
      ) : (
        <div className={styles.splitPane}>
          <div className={styles.tablePane}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Candidate</th><th>Stage</th><th>Diligence</th><th>Risk</th><th>Readiness</th><th>Open work</th></tr></thead>
                <tbody>
                  {candidateSummaries.map((summary) => {
                    const record = workspace.candidates.find((item) => item.candidate.id === summary.candidateId)!;
                    return (
                      <tr key={summary.candidateId} className={summary.candidateId === selectedCandidateId ? styles.selectedRow : undefined} onClick={() => onSelectCandidate(summary.candidateId)}>
                        <td><button type="button" className={styles.rowButton}><strong>{summary.name}</strong><span>{record.locationLabel || label(record.candidate.type)}</span></button></td>
                        <td><StageBadge stage={summary.stage} /></td>
                        <td>{summary.dueDiligenceSatisfied}/{summary.dueDiligenceRequired} required</td>
                        <td>{summary.openRisks} active{summary.highExposureRisks ? ` · ${summary.highExposureRisks} high` : ""}</td>
                        <td>{summary.readinessScore === null ? "Unknown" : `${summary.readinessScore.toFixed(0)} · ${summary.readinessCoverage?.toFixed(0) ?? 0}% coverage`}</td>
                        <td>{summary.openQuestions} questions · {summary.openFollowUps} follow-ups</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <CandidateDetail workspace={workspace} record={selected} act={act} />
        </div>
      )}
    </div>
  );
}

function AddCandidateForm({ workspace, act, onCreated }: { workspace: DueDiligenceWorkspaceState; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void; onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<"MARKET" | "PROPERTY">("PROPERTY");
  if (!open) return <button className="button button-primary" type="button" onClick={() => setOpen(true)}>Add candidate</button>;
  return (
    <form className={styles.inlineForm} onSubmit={(event) => {
      event.preventDefault();
      const candidateId = id("candidate");
      act(() => addCandidateToWorkspace(workspace, { id: candidateId, name, type, locationLabel: location, occurredAt: now() }), "Candidate added at Identified. No diligence item was marked complete.");
      onCreated(candidateId);
      setName(""); setLocation(""); setOpen(false);
    }}>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Candidate name" required />
      <select value={type} onChange={(event) => setType(event.target.value as "MARKET" | "PROPERTY")}><option value="PROPERTY">Property</option><option value="MARKET">Market</option></select>
      <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Location label" />
      <button className="button button-primary" type="submit">Add</button>
      <button className="button button-secondary" type="button" onClick={() => setOpen(false)}>Cancel</button>
    </form>
  );
}

function CandidateDetail({ workspace, record, act }: { workspace: DueDiligenceWorkspaceState; record?: DueDiligenceWorkspaceState["candidates"][number]; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const [toStage, setToStage] = useState<CandidateStage>("LONG_LIST");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [eliminationCategory, setEliminationCategory] = useState("");
  const [failedRequirement, setFailedRequirement] = useState("");
  if (!record) return <aside className={styles.detailPane}><EmptyRow title="Select a candidate" copy="Choose a row to inspect stage changes, elimination evidence and the auditable history." /></aside>;
  const history = [
    ...record.transitionHistory.map((item) => ({ at: item.occurredAt, type: "Transition", summary: `${label(item.fromStage)} → ${label(item.toStage)}`, reason: item.reason, evidence: item.evidenceIds, actor: item.actorId })),
    ...record.eliminations.map((item) => ({ at: item.eliminatedAt, type: "Elimination", summary: item.reasonCategory, reason: item.reason, evidence: item.evidenceIds, actor: item.authorId })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const recoverable = ["ELIMINATED", "ON_HOLD", "WITHDRAWN"].includes(record.candidate.stage);
  return (
    <aside className={styles.detailPane}>
      <div className={styles.detailHeader}><div><span className={styles.kicker}>Candidate detail</span><h3>{record.name}</h3></div><StageBadge stage={record.candidate.stage} /></div>
      {recoverable ? (
        <form className={styles.formStack} onSubmit={(event) => {
          event.preventDefault();
          act(() => reinstateWorkspaceCandidate(workspace, record.candidate.id, { transitionId: id("transition"), eventId: id("event"), toStage: toStage === "SELECTED" ? "DUE_DILIGENCE" : toStage as Exclude<CandidateStage, "ELIMINATED" | "ON_HOLD" | "WITHDRAWN" | "SELECTED">, reason, evidenceIds: splitReferences(evidence), occurredAt: now() }), "Candidate reinstated. Prior elimination records remain in history.");
          setReason(""); setEvidence("");
        }}>
          <h4>Reinstate historical candidate</h4>
          <label>Return to stage<select value={toStage} onChange={(event) => setToStage(event.target.value as CandidateStage)}>{ACTIVE_TRANSITION_STAGES.filter((stage) => stage !== "SELECTED").map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}</select></label>
          <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
          <label>Evidence references<input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Evidence IDs, comma separated" /></label>
          <button className="button button-primary" type="submit">Reinstate candidate</button>
        </form>
      ) : record.candidate.stage !== "SELECTED" ? (
        <>
          <form className={styles.formStack} onSubmit={(event) => {
            event.preventDefault();
            act(() => transitionWorkspaceCandidate(workspace, record.candidate.id, { transitionId: id("transition"), eventId: id("event"), toStage, reason, evidenceIds: splitReferences(evidence), occurredAt: now() }), "Candidate stage changed and an immutable transition record was appended.");
            setReason(""); setEvidence("");
          }}>
            <h4>Advance / change stage</h4>
            <label>Stage<select value={toStage} onChange={(event) => setToStage(event.target.value as CandidateStage)}>{candidateStageOrder.filter((stage) => stage !== record.candidate.stage && stage !== "ELIMINATED").map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}</select></label>
            <label>Reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
            <label>Evidence references<input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Evidence IDs, comma separated" /></label>
            <button className="button button-primary" type="submit">Record transition</button>
          </form>
          <form className={`${styles.formStack} ${styles.dangerZone}`} onSubmit={(event) => {
            event.preventDefault();
            act(() => eliminateWorkspaceCandidate(workspace, record.candidate.id, { transitionId: id("transition"), eliminationId: id("elimination"), eventId: id("event"), reasonCategory: eliminationCategory, reason, failedRequirementId: failedRequirement || undefined, evidenceIds: splitReferences(evidence), occurredAt: now() }), "Candidate eliminated. The record remains recoverable and the elimination evidence remains auditable.");
            setReason(""); setEvidence(""); setEliminationCategory(""); setFailedRequirement("");
          }}>
            <h4>Eliminate candidate</h4>
            <label>Reason category<input value={eliminationCategory} onChange={(event) => setEliminationCategory(event.target.value)} placeholder="e.g. Utility capacity" required /></label>
            <label>Failed requirement reference<input value={failedRequirement} onChange={(event) => setFailedRequirement(event.target.value)} /></label>
            <button className="button button-secondary" type="submit">Record elimination</button>
          </form>
        </>
      ) : <p className={styles.muted}>Selected candidates require a separate decision-reversal workflow before elimination.</p>}

      <div className={styles.sectionBlock}>
        <h4>Auditable candidate history</h4>
        {history.length === 0 ? <p className={styles.muted}>No transitions recorded yet.</p> : (
          <ol className={styles.timeline}>{history.map((item, index) => <li key={`${item.type}-${item.at}-${index}`}><time>{new Date(item.at).toLocaleString()}</time><strong>{item.summary}</strong><span>{item.reason}</span><small>{item.type} · Actor {item.actor} · Evidence {evidenceText(item.evidence)}</small></li>)}</ol>
        )}
      </div>
    </aside>
  );
}

function RiskView({ workspace, candidateId, selectedRiskId, onSelectCandidate, onSelectRisk, act }: { workspace: DueDiligenceWorkspaceState; candidateId: string; selectedRiskId: string; onSelectCandidate: (id: string) => void; onSelectRisk: (id: string) => void; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const record = workspace.candidates.find((item) => item.candidate.id === candidateId);
  const risk = record?.risks.find((item) => item.id === selectedRiskId);
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState(""); const [description, setDescription] = useState(""); const [category, setCategory] = useState<RiskCategory>("PROPERTY"); const [likelihood, setLikelihood] = useState<RiskLikelihood>(3); const [severity, setSeverity] = useState<RiskSeverity>(3); const [owner, setOwner] = useState("");
  return (
    <div className={styles.view}>
      <div className={styles.viewHeader}><div><span className={styles.kicker}>Risk register</span><h2>Track exposure, treatment and residual risk</h2></div><CandidateSelector workspace={workspace} value={candidateId} onChange={onSelectCandidate} /></div>
      {!record ? <EmptyRow title="Select a candidate" copy="Risks are project- and candidate-scoped. No risk is inferred from missing data." /> : (
        <>
          <div className={styles.toolbar}><button className="button button-primary" type="button" onClick={() => setAddOpen((value) => !value)}>Add risk</button></div>
          {addOpen ? <form className={styles.formBand} onSubmit={(event) => { event.preventDefault(); const riskId = id("risk"); act(() => addWorkspaceRisk(workspace, record.candidate.id, { id: riskId, category, title, description, likelihood, severity, ownerId: owner || undefined, occurredAt: now() }), "Risk added as Open using the Category 10 domain rules."); onSelectRisk(riskId); setTitle(""); setDescription(""); setOwner(""); setAddOpen(false); }}>
            <label>Title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as RiskCategory)}>{RISK_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Likelihood<select value={likelihood} onChange={(event) => setLikelihood(Number(event.target.value) as RiskLikelihood)}>{[1,2,3,4,5].map((item) => <option key={item}>{item}</option>)}</select></label><label>Severity<select value={severity} onChange={(event) => setSeverity(Number(event.target.value) as RiskSeverity)}>{[1,2,3,4,5].map((item) => <option key={item}>{item}</option>)}</select></label><label>Owner reference<input value={owner} onChange={(event) => setOwner(event.target.value)} /></label><label className={styles.wideField}>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} required /></label><button className="button button-primary" type="submit">Create risk</button>
          </form> : null}
          <div className={styles.splitPane}>
            <div className={styles.tablePane}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Risk</th><th>Category</th><th>L</th><th>S</th><th>Status</th><th>Owner</th><th>Mitigation</th></tr></thead><tbody>{record.risks.map((item) => <tr key={item.id} className={item.id === selectedRiskId ? styles.selectedRow : undefined} onClick={() => onSelectRisk(item.id)}><td><button className={styles.rowButton} type="button"><strong>{item.title}</strong><span>{item.description}</span></button></td><td>{label(item.category)}</td><td>{item.likelihood}</td><td>{item.severity}</td><td><StatusText value={item.status} /></td><td>{item.ownerId || "Unassigned"}</td><td>{item.mitigation || "—"}</td></tr>)}</tbody></table></div>{record.risks.length === 0 ? <EmptyRow title="No risks recorded" copy="Add only risks supported by project information or consultant findings." /> : null}</div>
            <RiskDetail workspace={workspace} candidateId={record.candidate.id} risk={risk} act={act} />
          </div>
        </>
      )}
    </div>
  );
}

function RiskDetail({ workspace, candidateId, risk, act }: { workspace: DueDiligenceWorkspaceState; candidateId: string; risk?: DueDiligenceWorkspaceState["candidates"][number]["risks"][number]; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const [status, setStatus] = useState<RiskStatus>(risk?.status ?? "OPEN"); const [note, setNote] = useState(""); const [mitigation, setMitigation] = useState(""); const [residualLikelihood, setResidualLikelihood] = useState<RiskLikelihood>(risk?.residualLikelihood ?? risk?.likelihood ?? 3); const [residualSeverity, setResidualSeverity] = useState<RiskSeverity>(risk?.residualSeverity ?? risk?.severity ?? 3); const [rationale, setRationale] = useState(""); const [evidence, setEvidence] = useState("");
  useEffect(() => { if (risk) { setStatus(risk.status); setMitigation(risk.mitigation ?? ""); setResidualLikelihood(risk.residualLikelihood ?? risk.likelihood); setResidualSeverity(risk.residualSeverity ?? risk.severity); } }, [risk]);
  if (!risk) return <aside className={styles.detailPane}><EmptyRow title="Select a risk" copy="Inspect mitigation, ownership, evidence and risk history." /></aside>;
  return <aside className={styles.detailPane}><div className={styles.detailHeader}><div><span className={styles.kicker}>{label(risk.category)}</span><h3>{risk.title}</h3></div><StatusText value={risk.status} /></div><dl className={styles.metaList}><div><dt>Likelihood</dt><dd>{risk.likelihood}</dd></div><div><dt>Severity</dt><dd>{risk.severity}</dd></div><div><dt>Residual</dt><dd>{risk.residualLikelihood ?? "—"} × {risk.residualSeverity ?? "—"}</dd></div><div><dt>Owner</dt><dd>{risk.ownerId || "Unassigned"}</dd></div><div><dt>Evidence</dt><dd>{evidenceText(risk.evidenceIds)}</dd></div></dl><form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); act(() => updateWorkspaceRisk(workspace, candidateId, risk.id, { historyId: id("risk-history"), status, note, mitigation: mitigation || undefined, residualLikelihood, residualSeverity, acceptanceRationale: status === "ACCEPTED" ? rationale : undefined, resolutionRationale: ["RESOLVED", "REJECTED"].includes(status) ? rationale : undefined, evidenceIds: splitReferences(evidence), occurredAt: now() }), "Risk updated and history preserved."); setNote(""); setRationale(""); setEvidence(""); }}><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as RiskStatus)}>{RISK_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Update note<textarea value={note} onChange={(event) => setNote(event.target.value)} required /></label><label>Mitigation<textarea value={mitigation} onChange={(event) => setMitigation(event.target.value)} placeholder="Required when status is Mitigating" /></label><div className={styles.twoFields}><label>Residual likelihood<select value={residualLikelihood} onChange={(event) => setResidualLikelihood(Number(event.target.value) as RiskLikelihood)}>{[1,2,3,4,5].map((item) => <option key={item}>{item}</option>)}</select></label><label>Residual severity<select value={residualSeverity} onChange={(event) => setResidualSeverity(Number(event.target.value) as RiskSeverity)}>{[1,2,3,4,5].map((item) => <option key={item}>{item}</option>)}</select></label></div>{["ACCEPTED", "RESOLVED", "REJECTED"].includes(status) ? <label>{status === "ACCEPTED" ? "Acceptance rationale" : "Resolution rationale"}<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} required /></label> : null}<label>New evidence references<input value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label><button className="button button-primary" type="submit">Record risk update</button></form></aside>;
}

function DiligenceView({ workspace, candidateId, onSelectCandidate, readinessDraft, setReadinessDraft, act }: { workspace: DueDiligenceWorkspaceState; candidateId: string; onSelectCandidate: (id: string) => void; readinessDraft: ReadinessFactor[]; setReadinessDraft: (value: ReadinessFactor[]) => void; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const record = workspace.candidates.find((item) => item.candidate.id === candidateId);
  const [itemOpen, setItemOpen] = useState(false); const [key, setKey] = useState(""); const [category, setCategory] = useState<DueDiligenceCategory>("OTHER"); const [question, setQuestion] = useState(""); const [required, setRequired] = useState(true); const [critical, setCritical] = useState(false); const [evidenceType, setEvidenceType] = useState("");
  const [dimension, setDimension] = useState<(typeof readinessDimensions)[number]>("OWNERSHIP"); const [readinessStatus, setReadinessStatus] = useState<ReadinessFactor["status"]>("UNKNOWN"); const [readinessScore, setReadinessScore] = useState(""); const [readinessWeight, setReadinessWeight] = useState("1"); const [blocking, setBlocking] = useState(false); const [readinessNote, setReadinessNote] = useState("");
  const latestReadiness = record?.readinessAssessments.at(-1);
  const gate = record ? evaluateCandidateAdvancement(workspace, record.candidate.id) : null;
  return <div className={styles.view}><div className={styles.viewHeader}><div><span className={styles.kicker}>Due diligence & readiness</span><h2>Resolve what is known, unknown and blocking</h2></div><CandidateSelector workspace={workspace} value={candidateId} onChange={(id) => { onSelectCandidate(id); setReadinessDraft([]); }} /></div>{!record ? <EmptyRow title="Select a candidate" copy="Checklist status, readiness and open questions remain candidate-specific." /> : <>
    <div className={styles.summaryStrip}><span>Required <strong>{record.checklist?.items.filter((item) => item.required && item.status !== "NOT_APPLICABLE").length ?? 0}</strong></span><span>Satisfied <strong>{record.checklist?.items.filter((item) => item.required && item.status === "SATISFIED").length ?? 0}</strong></span><span>Readiness <strong>{latestReadiness?.overallScore === null || latestReadiness?.overallScore === undefined ? "Unknown" : latestReadiness.overallScore.toFixed(0)}</strong></span><span>Coverage <strong>{latestReadiness ? `${latestReadiness.coveragePercent.toFixed(0)}%` : "0%"}</strong></span><span>Gate <strong>{gate?.allowed ? "Clear" : "Review"}</strong></span></div>
    {!gate?.allowed && gate?.reasons.length ? <div className={styles.gateNotice}><strong>Advancement review:</strong> {gate.reasons.join(" · ")}</div> : null}
    <div className={styles.toolbar}><button className="button button-primary" type="button" onClick={() => setItemOpen((value) => !value)}>Add diligence item</button></div>
    {itemOpen ? <form className={styles.formBand} onSubmit={(event) => { event.preventDefault(); act(() => addDueDiligenceItem(workspace, record.candidate.id, { checklistId: id("checklist"), itemId: id("diligence"), key: key || id("manual"), category, question, required, critical, requiredEvidenceType: evidenceType || undefined, occurredAt: now() }), "Due-diligence item added as Not Started. Completion was not fabricated."); setKey(""); setQuestion(""); setEvidenceType(""); setItemOpen(false); }}><label>Key<input value={key} onChange={(event) => setKey(event.target.value)} placeholder="utility-capacity" required /></label><label>Category<select value={category} onChange={(event) => setCategory(event.target.value as DueDiligenceCategory)}>{DILIGENCE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label><label className={styles.wideField}>Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} required /></label><label>Evidence type<input value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} placeholder="Optional required evidence type" /></label><label className={styles.checkLabel}><input type="checkbox" checked={required} onChange={(event) => setRequired(event.target.checked)} /> Required</label><label className={styles.checkLabel}><input type="checkbox" checked={critical} onChange={(event) => setCritical(event.target.checked)} /> Critical</label><button className="button button-primary" type="submit">Add Not Started item</button></form> : null}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Category</th><th>Question</th><th>Status</th><th>Required</th><th>Owner</th><th>Evidence</th><th>Update</th></tr></thead><tbody>{record.checklist?.items.map((item) => <DiligenceRow key={item.id} workspace={workspace} candidateId={record.candidate.id} item={item} act={act} />)}</tbody></table></div>{!record.checklist?.items.length ? <EmptyRow title="No diligence items yet" copy="Add project-specific questions. Every new item starts Not Started; unknown information is not treated as complete or failed." /> : null}
    <div className={styles.sectionBlock}><div className={styles.sectionHeading}><div><h3>Site readiness assessment</h3><p>Readiness remains separate from market attractiveness. Unknown dimensions reduce coverage rather than scoring as zero.</p></div></div><form className={styles.formBand} onSubmit={(event) => { event.preventDefault(); const factor: ReadinessFactor = { dimension, status: readinessStatus, weight: Number(readinessWeight), blocking, ...(readinessStatus !== "UNKNOWN" && readinessStatus !== "NOT_APPLICABLE" ? { score: Number(readinessScore) } : {}), ...(readinessNote.trim() ? { note: readinessNote.trim() } : {}) }; setReadinessDraft([...readinessDraft.filter((item) => item.dimension !== dimension), factor]); setReadinessNote(""); setReadinessScore(""); }}><label>Dimension<select value={dimension} onChange={(event) => setDimension(event.target.value as (typeof readinessDimensions)[number])}>{readinessDimensions.map((item) => <option key={item}>{item}</option>)}</select></label><label>Status<select value={readinessStatus} onChange={(event) => setReadinessStatus(event.target.value as ReadinessFactor["status"])}>{["READY","CONDITIONAL","NOT_READY","UNKNOWN","NOT_APPLICABLE"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Score<input type="number" min="0" max="100" value={readinessScore} disabled={readinessStatus === "UNKNOWN" || readinessStatus === "NOT_APPLICABLE"} onChange={(event) => setReadinessScore(event.target.value)} required={readinessStatus !== "UNKNOWN" && readinessStatus !== "NOT_APPLICABLE"} /></label><label>Weight<input type="number" min="0" step="0.1" value={readinessWeight} onChange={(event) => setReadinessWeight(event.target.value)} required /></label><label className={styles.checkLabel}><input type="checkbox" checked={blocking} onChange={(event) => setBlocking(event.target.checked)} /> Blocking</label><label className={styles.wideField}>Note<input value={readinessNote} onChange={(event) => setReadinessNote(event.target.value)} /></label><button className="button button-secondary" type="submit">Add / replace draft factor</button></form>{readinessDraft.length ? <><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Dimension</th><th>Status</th><th>Score</th><th>Weight</th><th>Blocking</th></tr></thead><tbody>{readinessDraft.map((factor) => <tr key={factor.dimension}><td>{label(factor.dimension)}</td><td>{label(factor.status)}</td><td>{factor.score ?? "—"}</td><td>{factor.weight}</td><td>{factor.blocking ? "Yes" : "No"}</td></tr>)}</tbody></table></div><button className="button button-primary" type="button" onClick={() => { act(() => addReadinessAssessment(workspace, record.candidate.id, { id: id("readiness"), factors: readinessDraft, occurredAt: now() }), "Readiness assessment recorded from entered factors. Unknown dimensions remain unknown."); setReadinessDraft([]); }}>Save readiness assessment</button></> : null}</div>
    <QuestionsAndFollowUps workspace={workspace} candidateId={record.candidate.id} act={act} />
  </>}</div>;
}

function DiligenceRow({ workspace, candidateId, item, act }: { workspace: DueDiligenceWorkspaceState; candidateId: string; item: DueDiligenceWorkspaceState["candidates"][number]["checklist"] extends infer _ ? import("../../../packages/domain-due-diligence/src/index").DueDiligenceItem : never; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const [status, setStatus] = useState<DueDiligenceStatus>(item.status); const [evidence, setEvidence] = useState(""); const [note, setNote] = useState(item.note ?? "");
  return <tr><td>{label(item.category)}</td><td><strong>{item.question}</strong>{item.critical ? <span className={styles.criticalTag}>Critical</span> : null}{item.requiredEvidenceType ? <small>Requires: {item.requiredEvidenceType}</small> : null}</td><td><StatusText value={item.status} /></td><td>{item.required ? "Yes" : "No"}</td><td>{item.ownerId || "Unassigned"}</td><td>{evidenceText(item.evidenceIds)}</td><td><div className={styles.rowEditor}><select value={status} onChange={(event) => setStatus(event.target.value as DueDiligenceStatus)}>{DILIGENCE_STATUSES.map((value) => <option key={value}>{value}</option>)}</select><input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Evidence refs" /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Note" /><button className="button button-secondary" type="button" onClick={() => { act(() => updateWorkspaceDueDiligenceItem(workspace, candidateId, item.id, { status, evidenceIds: splitReferences(evidence), note, occurredAt: now() }), "Diligence item updated through the domain evidence rules."); setEvidence(""); }}>Save</button></div></td></tr>;
}

function QuestionsAndFollowUps({ workspace, candidateId, act }: { workspace: DueDiligenceWorkspaceState; candidateId: string; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const record = workspace.candidates.find((item) => item.candidate.id === candidateId)!; const [question, setQuestion] = useState(""); const [action, setAction] = useState(""); const [dueAt, setDueAt] = useState("");
  return <div className={styles.dualList}><section><div className={styles.sectionHeading}><h3>Open questions</h3><span>{record.openQuestions.filter((item) => item.status === "OPEN").length} open</span></div><form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); act(() => addOpenQuestion(workspace, candidateId, { id: id("question"), text: question, occurredAt: now() }), "Open question added."); setQuestion(""); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What still needs to be confirmed?" required /><button className="button button-secondary" type="submit">Add</button></form><ul className={styles.plainList}>{record.openQuestions.map((item) => <li key={item.id}><StatusText value={item.status} /><span>{item.text}</span>{item.answer ? <small>{item.answer}</small> : null}</li>)}</ul></section><section><div className={styles.sectionHeading}><h3>Follow-up actions</h3><span>{record.followUps.filter((item) => item.status === "OPEN").length} open</span></div><form className={styles.inlineForm} onSubmit={(event) => { event.preventDefault(); act(() => addFollowUpAction(workspace, candidateId, { id: id("follow-up"), text: action, dueAt: dueAt ? toIso(dueAt) : undefined, occurredAt: now() }), "Follow-up action added."); setAction(""); setDueAt(""); }}><input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Next action" required /><input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /><button className="button button-secondary" type="submit">Add</button></form><ul className={styles.plainList}>{record.followUps.map((item) => <li key={item.id}><input type="checkbox" checked={item.status === "DONE"} onChange={(event) => act(() => setFollowUpDone(workspace, candidateId, item.id, event.target.checked, now()), "Follow-up status updated.")} /><span>{item.text}</span>{item.dueAt ? <small>{new Date(item.dueAt).toLocaleString()}</small> : null}</li>)}</ul></section></div>;
}

function VisitsPlanningView({ workspace, selectedVisitId, onSelectVisit, act }: { workspace: DueDiligenceWorkspaceState; selectedVisitId: string; onSelectVisit: (id: string) => void; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const visit = workspace.visits.find((item) => item.id === selectedVisitId); const [open, setOpen] = useState(false); const [title, setTitle] = useState(""); const [startsAt, setStartsAt] = useState(""); const [endsAt, setEndsAt] = useState(""); const [participants, setParticipants] = useState("");
  return <div className={styles.view}><div className={styles.viewHeader}><div><span className={styles.kicker}>Site visit planning</span><h2>Build an itinerary around candidate stops and people</h2></div><button className="button button-primary" type="button" onClick={() => setOpen((value) => !value)}>Plan visit</button></div>{open ? <form className={styles.formBand} onSubmit={(event) => { event.preventDefault(); const visitId = id("visit"); act(() => addSiteVisit(workspace, { id: visitId, title, startsAt: toIso(startsAt), endsAt: endsAt ? toIso(endsAt) : undefined, participantIds: splitReferences(participants), occurredAt: now() }), "Site visit planned. Stops and field findings remain empty until entered."); onSelectVisit(visitId); setTitle(""); setStartsAt(""); setEndsAt(""); setParticipants(""); setOpen(false); }}><label>Visit title<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label>Starts<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label>Ends<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label><label>Participant references<input value={participants} onChange={(event) => setParticipants(event.target.value)} placeholder="Contact/user IDs, comma separated" /></label><button className="button button-primary" type="submit">Create visit</button></form> : null}<div className={styles.splitPane}><div className={styles.tablePane}>{workspace.visits.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Visit</th><th>When</th><th>Status</th><th>Participants</th><th>Stops</th></tr></thead><tbody>{workspace.visits.map((item) => <tr key={item.id} className={item.id === selectedVisitId ? styles.selectedRow : undefined} onClick={() => onSelectVisit(item.id)}><td><button className={styles.rowButton} type="button"><strong>{item.title}</strong></button></td><td>{new Date(item.startsAt).toLocaleString()}</td><td>{label(item.status)}</td><td>{item.participantIds.length || "—"}</td><td>{workspace.stops.filter((stop) => stop.siteVisitId === item.id).length}</td></tr>)}</tbody></table></div> : <EmptyRow title="No site visits planned" copy="Create a visit only when dates and participants are actually known." />}</div><VisitDetail workspace={workspace} visit={visit} act={act} /></div></div>;
}

function VisitDetail({ workspace, visit, act }: { workspace: DueDiligenceWorkspaceState; visit?: DueDiligenceWorkspaceState["visits"][number]; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const [candidateId, setCandidateId] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [hosts, setHosts] = useState(""); const [navigation, setNavigation] = useState(""); const [note, setNote] = useState("");
  if (!visit) return <aside className={styles.detailPane}><EmptyRow title="Select a visit" copy="Inspect the itinerary, participants, hosts and candidate stops." /></aside>;
  const stops = workspace.stops.filter((stop) => stop.siteVisitId === visit.id).sort((a, b) => a.sequence - b.sequence);
  return <aside className={styles.detailPane}><div className={styles.detailHeader}><div><span className={styles.kicker}>Itinerary</span><h3>{visit.title}</h3></div><StatusText value={visit.status} /></div><dl className={styles.metaList}><div><dt>Starts</dt><dd>{new Date(visit.startsAt).toLocaleString()}</dd></div><div><dt>Ends</dt><dd>{visit.endsAt ? new Date(visit.endsAt).toLocaleString() : "Not set"}</dd></div><div><dt>Participants</dt><dd>{evidenceText(visit.participantIds)}</dd></div></dl><div className={styles.itinerary}>{stops.map((stop) => { const candidate = workspace.candidates.find((item) => item.candidate.id === stop.candidateId); return <div key={stop.id} className={styles.stopRow}><span className={styles.stopSequence}>{stop.sequence}</span><div><strong>{candidate?.name ?? stop.candidateId}</strong><span>{new Date(stop.scheduledStart).toLocaleString()} {stop.scheduledEnd ? `– ${new Date(stop.scheduledEnd).toLocaleTimeString()}` : ""}</span><small>Hosts: {evidenceText(stop.hostContactIds)} · {stop.note || "No stop note"}</small></div></div>; })}{!stops.length ? <p className={styles.muted}>No stops added.</p> : null}</div><form className={styles.formStack} onSubmit={(event) => { event.preventDefault(); act(() => addSiteVisitStop(workspace, { id: id("stop"), siteVisitId: visit.id, candidateId, sequence: stops.length + 1, scheduledStart: toIso(start), scheduledEnd: end ? toIso(end) : undefined, hostContactIds: splitReferences(hosts), navigationUri: navigation || undefined, note: note || undefined, occurredAt: now() }), "Candidate stop added and itinerary overlap rules validated."); setStart(""); setEnd(""); setHosts(""); setNavigation(""); setNote(""); }}><h4>Add candidate stop</h4><CandidateSelector workspace={workspace} value={candidateId} onChange={setCandidateId} /><div className={styles.twoFields}><label>Start<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label>End<input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label></div><label>Host references<input value={hosts} onChange={(event) => setHosts(event.target.value)} placeholder="Contact IDs, comma separated" /></label><label>Navigation URI<input value={navigation} onChange={(event) => setNavigation(event.target.value)} placeholder="Map/navigation link" /></label><label>Stop note<textarea value={note} onChange={(event) => setNote(event.target.value)} /></label><button className="button button-primary" type="submit" disabled={!candidateId}>Add stop</button></form></aside>;
}

function FieldMode({ workspace, selectedVisitId, selectedStopId, onSelectVisit, onSelectStop, candidate, act }: { workspace: DueDiligenceWorkspaceState; selectedVisitId: string; selectedStopId: string; onSelectVisit: (id: string) => void; onSelectStop: (id: string) => void; candidate?: DueDiligenceWorkspaceState["candidates"][number]; act: (operation: () => DueDiligenceWorkspaceState, message?: string) => void }) {
  const [category, setCategory] = useState("FIELD_NOTE"); const [assessment, setAssessment] = useState<"POSITIVE" | "NEUTRAL" | "CONCERN" | "UNKNOWN">("NEUTRAL"); const [text, setText] = useState(""); const [followUp, setFollowUp] = useState(false); const [evidence, setEvidence] = useState(""); const [findingObservation, setFindingObservation] = useState(""); const [findingType, setFindingType] = useState<FindingType>("CONCERN"); const [findingDescription, setFindingDescription] = useState("");
  const stops = workspace.stops.filter((stop) => stop.siteVisitId === selectedVisitId).sort((a, b) => a.sequence - b.sequence);
  const observations = workspace.observations.filter((item) => item.stopId === selectedStopId);
  const findings = workspace.findings.filter((item) => item.stopId === selectedStopId);
  return <div className={styles.fieldMode}><header className={styles.fieldHeader}><div><span className={styles.kicker}>Mobile field mode</span><h2>{candidate?.name ?? "Choose a candidate stop"}</h2></div><span className={styles.syncBadge}>Offline capable · local draft</span></header><div className={styles.fieldSelectors}><label>Visit<select value={selectedVisitId} onChange={(event) => onSelectVisit(event.target.value)}><option value="">Select visit</option>{workspace.visits.map((visit) => <option key={visit.id} value={visit.id}>{visit.title}</option>)}</select></label><label>Stop<select value={selectedStopId} onChange={(event) => onSelectStop(event.target.value)}><option value="">Select stop</option>{stops.map((stop) => { const record = workspace.candidates.find((item) => item.candidate.id === stop.candidateId); return <option key={stop.id} value={stop.id}>{stop.sequence}. {record?.name ?? stop.candidateId}</option>; })}</select></label></div>{!candidate || !selectedVisitId || !selectedStopId ? <EmptyRow title="Choose an itinerary stop" copy="Field checklists, notes, evidence hooks and findings are recorded against a specific candidate stop." /> : <>
    <section className={styles.fieldSection}><div className={styles.sectionHeading}><h3>Field checklist</h3><span>{candidate.checklist?.items.length ?? 0} items</span></div>{candidate.checklist?.items.length ? <div className={styles.fieldChecklist}>{candidate.checklist.items.map((item) => <DiligenceRow key={item.id} workspace={workspace} candidateId={candidate.candidate.id} item={item} act={act} />)}</div> : <p className={styles.muted}>No due-diligence checklist items exist for this candidate. Nothing is implicitly marked complete.</p>}</section>
    <section className={styles.fieldSection}><h3>Notes & observations</h3><form className={styles.fieldForm} onSubmit={(event) => { event.preventDefault(); const observationId = id("observation"); act(() => addFieldObservation(workspace, { id: observationId, candidateId: candidate.candidate.id, siteVisitId: selectedVisitId, stopId: selectedStopId, category, assessment, text, evidenceIds: splitReferences(evidence), followUpRequired: followUp, occurredAt: now() }), "Field observation recorded as unverified. It did not overwrite a verified property fact."); setText(""); setEvidence(""); setFollowUp(false); }}><label>Category<input value={category} onChange={(event) => setCategory(event.target.value)} /></label><label>Assessment<select value={assessment} onChange={(event) => setAssessment(event.target.value as typeof assessment)}>{["POSITIVE","NEUTRAL","CONCERN","UNKNOWN"].map((item) => <option key={item}>{item}</option>)}</select></label><label>Field note<textarea rows={5} value={text} onChange={(event) => setText(event.target.value)} required /></label><label>Evidence references<input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Pending hook IDs or authoritative evidence IDs" /></label><label className={styles.checkLabel}><input type="checkbox" checked={followUp} onChange={(event) => setFollowUp(event.target.checked)} /> Follow-up required</label><button className="button button-primary" type="submit">Record unverified observation</button></form><ul className={styles.fieldFeed}>{observations.map((item) => <li key={item.id}><div><StatusText value={item.assessment} /><time>{new Date(item.recordedAt).toLocaleTimeString()}</time></div><strong>{item.category}</strong><p>{item.text}</p><small>{label(item.verificationState)} · Evidence {evidenceText(item.evidenceIds)}</small></li>)}</ul></section>
    <section className={styles.fieldSection}><h3>Photos & evidence hooks</h3><p className={styles.muted}>File metadata is retained locally as a pending upload hook. Binary upload is not claimed until the authoritative object-storage adapter is connected.</p><input className={styles.fileInput} type="file" multiple accept="image/*,video/*,audio/*,.pdf" onChange={(event) => { const files = Array.from(event.target.files ?? []); let next = workspace; for (const file of files) { const mediaType = file.type.startsWith("image/") ? "PHOTO" : file.type.startsWith("video/") ? "VIDEO" : file.type.startsWith("audio/") ? "AUDIO" : "DOCUMENT"; next = addLocalEvidenceHook(next, { id: id("local-evidence"), candidateId: candidate.candidate.id, siteVisitId: selectedVisitId, stopId: selectedStopId, name: file.name, mediaType, mimeType: file.type, size: file.size, capturedAt: now() }); } act(() => next, `${files.length} local evidence hook(s) recorded; binary files were not represented as uploaded.`); event.target.value = ""; }} /><ul className={styles.plainList}>{workspace.evidenceHooks.filter((hook) => hook.stopId === selectedStopId).map((hook) => <li key={hook.id}><StatusText value="PENDING_UPLOAD" /><span>{hook.name}</span><small>{hook.id} · {hook.size ? `${Math.ceil(hook.size / 1024)} KB` : "size unknown"}</small></li>)}</ul></section>
    <QuestionsAndFollowUps workspace={workspace} candidateId={candidate.candidate.id} act={act} />
    <section className={styles.fieldSection}><h3>Visit findings</h3><form className={styles.fieldForm} onSubmit={(event) => { event.preventDefault(); act(() => addVisitFinding(workspace, { id: id("finding"), observationId: findingObservation, type: findingType, description: findingDescription, followUpRequired: findingType === "CONCERN" || findingType === "CONDITION", occurredAt: now() }), "Structured visit finding created from the selected field observation."); setFindingDescription(""); }}><label>Observation<select value={findingObservation} onChange={(event) => setFindingObservation(event.target.value)} required><option value="">Select recorded observation</option>{observations.map((item) => <option key={item.id} value={item.id}>{item.category}: {item.text.slice(0, 60)}</option>)}</select></label><label>Finding type<select value={findingType} onChange={(event) => setFindingType(event.target.value as FindingType)}>{FINDING_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label><label>Description<textarea value={findingDescription} onChange={(event) => setFindingDescription(event.target.value)} required /></label><button className="button button-primary" type="submit">Create finding</button></form><ul className={styles.fieldFeed}>{findings.map((item) => <li key={item.id}><div><StatusText value={item.type} /><StatusText value={item.status} /></div><p>{item.description}</p><small>Evidence {evidenceText(item.evidenceIds)}{item.followUpRequired ? " · Follow-up required" : ""}</small></li>)}</ul></section>
  </>}</div>;
}

function StageBadge({ stage }: { stage: CandidateStage }) {
  return <span className={`${styles.stageBadge} ${stage === "ELIMINATED" ? styles.stageEliminated : stage === "SELECTED" ? styles.stageSelected : ""}`}>{label(stage)}</span>;
}

function StatusText({ value }: { value: string }) {
  return <span className={styles.statusText}>{label(value)}</span>;
}

function EmptyRow({ title, copy }: { title: string; copy: string }) {
  return <div className={styles.emptyRow}><strong>{title}</strong><span>{copy}</span></div>;
}
