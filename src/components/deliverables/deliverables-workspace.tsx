"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import {
  buildClientReportSnapshot,
  CLIENT_REPORT_STORAGE_KEY,
  clientExposureSummary,
  evidenceImpact,
  parseDecisionPacket,
  type FrozenProjectDecisionPacket,
} from "./decision-packet";
import styles from "./deliverables.module.css";

const tabs = ["Evidence", "Recommendation", "Client View", "Deliverables"] as const;
type Tab = (typeof tabs)[number];

const lifecycle = ["DRAFT", "INTERNAL_REVIEW", "CLIENT_REVIEW", "FINAL"] as const;

function display(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function score(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(1);
}

function label(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function DeliverablesWorkspace() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [packet, setPacket] = useState<FrozenProjectDecisionPacket | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("Evidence");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const exposure = useMemo(() => (packet ? clientExposureSummary(packet) : null), [packet]);
  const selectedEvidence = useMemo(
    () => packet?.evidence.find((item) => item.id === selectedEvidenceId) ?? packet?.evidence[0],
    [packet, selectedEvidenceId],
  );
  const selectedLinks = useMemo(
    () => (packet && selectedEvidence ? packet.evidenceLinks.filter((item) => item.evidenceId === selectedEvidence.id) : []),
    [packet, selectedEvidence],
  );
  const impact = useMemo(() => {
    if (!packet || !selectedEvidence) return null;
    try {
      return evidenceImpact(packet, selectedEvidence.id);
    } catch {
      return null;
    }
  }, [packet, selectedEvidence]);
  const clientPreview = useMemo(() => {
    if (!packet) return null;
    try {
      return buildClientReportSnapshot(packet, packet.snapshot.createdAt);
    } catch {
      return null;
    }
  }, [packet]);

  async function importPacket(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const next = parseDecisionPacket(parsed);
      setPacket(next);
      setSelectedEvidenceId(next.evidence[0]?.id ?? null);
      setLoadError(null);
      setGenerationError(null);
      setActiveTab("Evidence");
    } catch (error) {
      setPacket(null);
      setLoadError(error instanceof Error ? error.message : "The decision packet could not be read.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function createClientSnapshot() {
    if (!packet) return null;
    try {
      const report = buildClientReportSnapshot(packet);
      setGenerationError(null);
      return report;
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "The client report could not be generated.");
      return null;
    }
  }

  function openClientReport(): void {
    const report = createClientSnapshot();
    if (!report) return;
    sessionStorage.setItem(CLIENT_REPORT_STORAGE_KEY, JSON.stringify(report));
    router.push("/deliverables/client");
  }

  function downloadClientSnapshot(): void {
    const report = createClientSnapshot();
    if (!report) return;
    const safeProjectName = report.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
    downloadJson(`${safeProjectName}-client-decision-snapshot-v${report.decision.recommendationVersion}.json`, report);
  }

  if (!packet) {
    return (
      <>
        <PageHeader
          eyebrow="Decision output"
          title="Deliverables"
          description="Review evidence, recommendations and the exact project snapshot used for client-facing decision outputs."
        />
        <section className={styles.importWorkspace}>
          <div className={styles.importPrimary}>
            <span className={styles.kicker}>Authoritative input</span>
            <h2>Open a frozen project decision packet</h2>
            <p>
              Import a versioned Category 11 packet produced from project data. AccelSSA validates project scope and preserves the referenced decision versions before anything can be shown to a client.
            </p>
            <label className={styles.primaryButton}>
              Import project packet
              <input
                ref={fileInput}
                className={styles.hiddenInput}
                type="file"
                accept="application/json,.json"
                onChange={(event) => void importPacket(event.target.files?.[0])}
              />
            </label>
            {loadError ? <div className={styles.errorBanner} role="alert">{loadError}</div> : null}
          </div>
          <div className={styles.importRules}>
            <h3>Decision packet requirements</h3>
            <dl>
              <div><dt>Schema</dt><dd>1.0</dd></div>
              <div><dt>Scope</dt><dd>One tenant + one project</dd></div>
              <div><dt>Versioning</dt><dd>Decision snapshot + recommendation version required</dd></div>
              <div><dt>Client safety</dt><dd>INTERNAL and HIGHLY_RESTRICTED content is excluded</dd></div>
            </dl>
            <p className={styles.note}>Persistent project editing remains unavailable until the shared project database adapter is active. This workspace does not fabricate project facts.</p>
          </div>
        </section>
      </>
    );
  }

  const recommendationIndex = lifecycle.indexOf(packet.recommendation.status);
  const visibleDocuments = packet.documents.filter((item) => item.record.visibility === "CLIENT" || item.record.visibility === "EXTERNAL_SHARED").length;

  return (
    <div className={styles.workspace}>
      <div className={styles.workspaceHeader}>
        <div>
          <span className={styles.kicker}>Decision output</span>
          <h1>{packet.project.name}</h1>
          <div className={styles.projectMeta}>
            <span>{packet.project.clientName ?? "Client not recorded"}</span>
            <span>Snapshot <code>{packet.snapshot.id}</code></span>
            <span>Recommendation v{packet.recommendation.version}</span>
            <span className={styles.statusPill}>{label(packet.recommendation.status)}</span>
          </div>
        </div>
        <label className={styles.secondaryButton}>
          Replace packet
          <input
            ref={fileInput}
            className={styles.hiddenInput}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void importPacket(event.target.files?.[0])}
          />
        </label>
      </div>

      <nav className={styles.tabs} aria-label="Deliverables workspace">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab ? styles.activeTab : styles.tab}
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "Evidence" ? (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Documents</h2>
                <p>Versioned source material attached to this decision packet.</p>
              </div>
              <span className={styles.count}>{packet.documents.length}</span>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>Document</th><th>Category</th><th>Version</th><th>Source date</th><th>Visibility</th></tr></thead>
                <tbody>
                  {packet.documents.length ? packet.documents.map(({ record, currentVersion }) => (
                    <tr key={record.id}>
                      <td><strong>{record.title}</strong><div className={styles.subtle}>{currentVersion?.originalFilename ?? record.id}</div></td>
                      <td>{label(record.category)}</td>
                      <td>{currentVersion ? `v${currentVersion.versionNumber}` : "—"}</td>
                      <td>{currentVersion?.sourceDate ?? "—"}</td>
                      <td><span className={record.visibility === "INTERNAL" ? styles.internalPill : styles.visibilityPill}>{label(record.visibility)}</span></td>
                    </tr>
                  )) : <tr><td colSpan={5} className={styles.emptyCell}>No documents are included in this snapshot.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.evidenceLayout}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div><h2>Evidence register</h2><p>Evidence remains distinct from the findings and decisions it supports.</p></div>
                <span className={styles.count}>{packet.evidence.length}</span>
              </div>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead><tr><th>Evidence</th><th>Source</th><th>Confidence</th><th>Visibility</th></tr></thead>
                  <tbody>
                    {packet.evidence.length ? packet.evidence.map((item) => (
                      <tr className={selectedEvidence?.id === item.id ? styles.selectedRow : undefined} key={item.id}>
                        <td>
                          <button className={styles.rowButton} type="button" onClick={() => setSelectedEvidenceId(item.id)}>{item.title}</button>
                          <div className={styles.subtle}>{item.description ?? item.id}</div>
                        </td>
                        <td>{label(item.sourceType)}</td>
                        <td>{item.confidence ? label(item.confidence) : "—"}</td>
                        <td><span className={item.visibility === "INTERNAL" ? styles.internalPill : styles.visibilityPill}>{label(item.visibility)}</span></td>
                      </tr>
                    )) : <tr><td colSpan={4} className={styles.emptyCell}>No evidence is included in this snapshot.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className={styles.inspector}>
              <span className={styles.kicker}>Evidence graph</span>
              {selectedEvidence ? (
                <>
                  <h2>{selectedEvidence.title}</h2>
                  <dl className={styles.inspectorList}>
                    <div><dt>Evidence ID</dt><dd><code>{selectedEvidence.id}</code></dd></div>
                    <div><dt>Observation</dt><dd>{selectedEvidence.observationDate ?? selectedEvidence.effectiveDate ?? "—"}</dd></div>
                    <div><dt>Linked targets</dt><dd>{selectedLinks.length}</dd></div>
                    <div><dt>Downstream nodes</dt><dd>{impact?.impactedNodes.length ?? 0}</dd></div>
                  </dl>
                  <h3>Direct links</h3>
                  <div className={styles.graphList}>
                    {selectedLinks.length ? selectedLinks.map((link) => (
                      <div className={styles.graphEdge} key={link.id}>
                        <span>{label(link.relationship)}</span>
                        <strong>{label(link.targetType)}</strong>
                        <code>{link.targetId}</code>
                      </div>
                    )) : <p className={styles.note}>No direct evidence links are present.</p>}
                  </div>
                  {impact?.recommendationIds.length ? (
                    <div className={styles.impactCallout}>Impacts recommendation {impact.recommendationIds.map((id) => <code key={id}>{id}</code>)}</div>
                  ) : null}
                </>
              ) : <p className={styles.note}>Select an evidence item to inspect its decision links.</p>}
            </aside>
          </div>
        </div>
      ) : null}

      {activeTab === "Recommendation" ? (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><h2>Recommendation lifecycle</h2><p>The imported snapshot is read-only; final records are never edited in place.</p></div>
              <span className={styles.statusPill}>{label(packet.recommendation.status)}</span>
            </div>
            <ol className={styles.lifecycle}>
              {lifecycle.map((status, index) => (
                <li className={index <= recommendationIndex ? styles.lifecycleComplete : styles.lifecycleFuture} key={status}>
                  <span>{index + 1}</span><strong>{label(status)}</strong>
                </li>
              ))}
            </ol>
          </section>

          <article className={styles.documentPanel}>
            <header>
              <span className={styles.kicker}>Executive recommendation</span>
              <h2>{packet.recommendation.title}</h2>
            </header>
            <section>
              <h3>Executive summary</h3>
              <p>{packet.recommendation.executiveSummary}</p>
            </section>
            <section>
              <h3>Consultant rationale</h3>
              <p>{packet.recommendation.rationale}</p>
            </section>
          </article>

          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Finalist comparison</h2><p>Frozen comparison values are displayed as supplied; missing values remain unknown.</p></div><span className={styles.count}>{packet.finalists.length}</span></div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead><tr><th>Finalist</th><th>Disposition</th><th>Qualification</th><th>Score</th><th>10-year cost</th><th>Incentive NPV</th><th>Readiness</th><th>High risks</th></tr></thead>
                <tbody>
                  {packet.finalists.length ? packet.finalists.map((item) => (
                    <tr key={item.recommendation.id}>
                      <td><strong>{item.name}</strong><div className={styles.subtle}>{item.geography ?? item.recommendation.candidateId}</div></td>
                      <td>{label(item.recommendation.disposition)}</td>
                      <td>{display(item.qualification)}</td>
                      <td>{score(item.score)}</td>
                      <td>{display(item.tenYearCost)}</td>
                      <td>{display(item.incentiveNpv)}</td>
                      <td>{item.siteReadiness === undefined ? "—" : `${item.siteReadiness.toFixed(0)}/100`}</td>
                      <td>{display(item.highRisksOpen)}</td>
                    </tr>
                  )) : <tr><td colSpan={8} className={styles.emptyCell}>No finalist records are included in this snapshot.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <div className={styles.twoColumn}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}><div><h2>Conditions</h2><p>Conditions remain explicit and version-bound.</p></div><span className={styles.count}>{packet.conditions.length}</span></div>
              <div className={styles.conditionList}>
                {packet.conditions.length ? packet.conditions.map((condition) => (
                  <div className={styles.conditionRow} key={condition.id}>
                    <span className={styles.conditionStatus}>{label(condition.status)}</span>
                    <div><strong>{condition.description}</strong><div className={styles.subtle}>{condition.dueDate ? `Due ${condition.dueDate}` : "No due date"} · {label(condition.visibility)}</div></div>
                  </div>
                )) : <p className={styles.note}>No recommendation conditions are included.</p>}
              </div>
            </section>
            <section className={styles.panel}>
              <h2>Next steps</h2>
              <p className={styles.longText}>{packet.recommendation.nextSteps ?? "No next steps were recorded in this recommendation version."}</p>
              <div className={styles.versionBox}>
                <span>Decision snapshot</span><code>{packet.snapshot.id}</code>
                <span>Requirements</span><code>{packet.snapshot.references.requirementsVersionId}</code>
                <span>Recommendation</span><code>{packet.recommendation.id} · v{packet.recommendation.version}</code>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {activeTab === "Client View" ? (
        <div className={styles.clientGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Client visibility check</h2><p>Client projection is derived from item-level visibility and confidentiality.</p></div></div>
            <dl className={styles.visibilitySummary}>
              <div><dt>Client-visible items</dt><dd>{exposure?.visible ?? 0}</dd></div>
              <div><dt>Omitted internal/restricted</dt><dd>{exposure?.omitted ?? 0}</dd></div>
              <div><dt>Client-visible documents</dt><dd>{visibleDocuments}</dd></div>
              <div><dt>Recommendation status</dt><dd>{label(packet.recommendation.status)}</dd></div>
            </dl>
            {exposure?.omitted ? <p className={styles.safetyNote}>Internal or restricted items remain in the consultant workspace and are not copied into the client report snapshot.</p> : null}
            {clientPreview ? (
              <div className={styles.actionRow}>
                <button className={styles.primaryButton} type="button" onClick={openClientReport}>Open client-ready report</button>
                <button className={styles.secondaryButton} type="button" onClick={downloadClientSnapshot}>Download client snapshot JSON</button>
              </div>
            ) : <div className={styles.blockedBanner}>Client output is unavailable until the recommendation reaches Client Review or Final and is explicitly client-visible.</div>}
            {generationError ? <div className={styles.errorBanner} role="alert">{generationError}</div> : null}
          </section>

          <section className={styles.previewPage} aria-label="Client project preview">
            {clientPreview ? (
              <>
                <div className={styles.previewHeader}><span>Client project view</span><strong>{clientPreview.project.name}</strong><small>{clientPreview.project.clientName ?? "Client"}</small></div>
                <div className={styles.previewSection}><h3>Executive summary</h3><p>{clientPreview.recommendation.executiveSummary}</p></div>
                <div className={styles.previewSection}><h3>Finalists</h3>{clientPreview.finalists.map((item) => <div className={styles.previewCandidate} key={item.candidateId}><strong>{item.name}</strong><span>{label(item.disposition)}</span></div>)}</div>
                <div className={styles.previewFooter}>Snapshot {clientPreview.decision.snapshotId} · Recommendation v{clientPreview.decision.recommendationVersion}</div>
              </>
            ) : <div className={styles.previewBlocked}>No client-approved recommendation is available for preview.</div>}
          </section>
        </div>
      ) : null}

      {activeTab === "Deliverables" ? (
        <section className={styles.panel}>
          <div className={styles.panelHeader}><div><h2>Deliverables</h2><p>Only formats that work in the current product are shown.</p></div></div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th>Deliverable</th><th>Source</th><th>Output</th><th>Client visibility</th><th></th></tr></thead>
              <tbody>
                <tr>
                  <td><strong>Client Recommendation Report</strong><div className={styles.subtle}>Executive summary, finalists, conditions, evidence appendix and version record.</div></td>
                  <td><code>{packet.snapshot.id}</code><div className={styles.subtle}>Recommendation v{packet.recommendation.version}</div></td>
                  <td>Printable / Save as PDF</td>
                  <td>{clientPreview ? "Available" : "Blocked"}</td>
                  <td className={styles.actionCell}><button className={styles.primaryButton} type="button" disabled={!clientPreview} onClick={openClientReport}>Generate report</button></td>
                </tr>
                <tr>
                  <td><strong>Client Decision Snapshot</strong><div className={styles.subtle}>Sanitized JSON preserving the exact source versions shown to the client.</div></td>
                  <td><code>{packet.snapshot.id}</code></td>
                  <td>JSON</td>
                  <td>{clientPreview ? "Available" : "Blocked"}</td>
                  <td className={styles.actionCell}><button className={styles.secondaryButton} type="button" disabled={!clientPreview} onClick={downloadClientSnapshot}>Download JSON</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          {!clientPreview ? <div className={styles.blockedBanner}>Deliverable generation requires a client-visible recommendation in Client Review or Final status.</div> : null}
          {generationError ? <div className={styles.errorBanner} role="alert">{generationError}</div> : null}
        </section>
      ) : null}
    </div>
  );
}
