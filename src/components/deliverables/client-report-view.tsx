"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CLIENT_REPORT_STORAGE_KEY,
  type ClientReportSnapshot,
} from "./decision-packet";
import styles from "./deliverables.module.css";

function label(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

function display(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
}

function score(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(1);
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

export function ClientReportView() {
  const [report, setReport] = useState<ClientReportSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(CLIENT_REPORT_STORAGE_KEY);
    if (!raw) {
      setError("No client report has been generated in this browser session.");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as ClientReportSnapshot;
      if (!parsed || parsed.schemaVersion !== "1.0" || typeof parsed.reportId !== "string") {
        throw new Error("The stored client report is not a supported report snapshot.");
      }
      setReport(parsed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The client report could not be opened.");
    }
  }, []);

  if (!report) {
    return (
      <div className={styles.clientReportScreen}>
        <div className={styles.reportEmpty}>
          <span className={styles.kicker}>Client report</span>
          <h1>Report unavailable</h1>
          <p>{error ?? "Opening report…"}</p>
          {error ? <Link className={styles.primaryButton} href="/deliverables">Return to Deliverables</Link> : null}
        </div>
      </div>
    );
  }

  const filename = `${report.project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}-client-decision-snapshot-v${report.decision.recommendationVersion}.json`;

  return (
    <div className={styles.clientReportScreen}>
      <div className={styles.reportToolbar} data-print-hidden>
        <div>
          <strong>Client-ready report</strong>
          <span>Snapshot {report.decision.snapshotId} · Recommendation v{report.decision.recommendationVersion}</span>
        </div>
        <div className={styles.actionRow}>
          <Link className={styles.secondaryButton} href="/deliverables">Back to workspace</Link>
          <button className={styles.secondaryButton} type="button" onClick={() => downloadJson(filename, report)}>Download snapshot JSON</button>
          <button className={styles.primaryButton} type="button" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>

      <main className={styles.reportDocument}>
        <header className={styles.reportCover}>
          <div>
            <span className={styles.reportBrand}>AccelSSA</span>
            <span className={styles.reportType}>Executive Recommendation</span>
          </div>
          <div className={styles.reportCoverBody}>
            <p>{report.project.clientName ?? "Client"}</p>
            <h1>{report.project.name}</h1>
            <dl className={styles.reportCoverMeta}>
              <div><dt>Facility</dt><dd>{report.project.facilityType ?? "Not recorded"}</dd></div>
              <div><dt>Project stage</dt><dd>{report.project.projectStage ?? "Not recorded"}</dd></div>
              <div><dt>Target opening</dt><dd>{report.project.targetOpeningDate ?? "Not recorded"}</dd></div>
              <div><dt>Recommendation</dt><dd>Version {report.decision.recommendationVersion}</dd></div>
            </dl>
          </div>
          <div className={styles.reportCoverFooter}>
            <span>Prepared from frozen decision snapshot</span>
            <code>{report.decision.snapshotId}</code>
          </div>
        </header>

        <section className={styles.reportSection}>
          <div className={styles.reportSectionHeading}><span>01</span><h2>Executive Summary</h2></div>
          <p className={styles.reportLead}>{report.recommendation.executiveSummary}</p>
          <div className={styles.reportRecommendationBox}>
            <span>Recommendation</span>
            <strong>{report.recommendation.title}</strong>
            <p>{report.recommendation.rationale}</p>
          </div>
        </section>

        <section className={styles.reportSection}>
          <div className={styles.reportSectionHeading}><span>02</span><h2>Finalist Comparison</h2></div>
          <div className={styles.reportTableWrap}>
            <table className={styles.reportTable}>
              <thead>
                <tr><th>Finalist</th><th>Disposition</th><th>Qualification</th><th>Score</th><th>10-year cost</th><th>Incentive NPV</th><th>Readiness</th><th>High risks</th></tr>
              </thead>
              <tbody>
                {report.finalists.length ? report.finalists.map((item) => (
                  <tr key={item.candidateId}>
                    <td><strong>{item.name}</strong><small>{item.geography ?? item.candidateId}</small></td>
                    <td>{label(item.disposition)}</td>
                    <td>{display(item.qualification)}</td>
                    <td>{score(item.score)}</td>
                    <td>{display(item.tenYearCost)}</td>
                    <td>{display(item.incentiveNpv)}</td>
                    <td>{item.siteReadiness === undefined ? "—" : `${item.siteReadiness.toFixed(0)}/100`}</td>
                    <td>{display(item.highRisksOpen)}</td>
                  </tr>
                )) : <tr><td colSpan={8}>No client-visible finalist comparison was included in this snapshot.</td></tr>}
              </tbody>
            </table>
          </div>
          {report.finalists.map((item) => (
            <div className={styles.reportCandidateNote} key={`${item.candidateId}-rationale`}>
              <strong>{item.name}</strong>
              <span>{label(item.disposition)}</span>
              <p>{item.rationale}</p>
              {item.conditionsSummary ? <small>Conditions: {item.conditionsSummary}</small> : null}
            </div>
          ))}
        </section>

        {report.sections.filter((section) => !["EXECUTIVE_SUMMARY", "FINALISTS", "RECOMMENDATION", "CONDITIONS", "NEXT_STEPS"].includes(section.sectionType)).map((section, index) => (
          <section className={styles.reportSection} key={section.id}>
            <div className={styles.reportSectionHeading}><span>{String(index + 3).padStart(2, "0")}</span><h2>{section.title}</h2></div>
            <p className={styles.reportBody}>{section.narrative}</p>
          </section>
        ))}

        <section className={styles.reportSection}>
          <div className={styles.reportSectionHeading}><span>•</span><h2>Conditions & Next Steps</h2></div>
          {report.conditions.length ? (
            <table className={styles.reportTable}>
              <thead><tr><th>Condition</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>{report.conditions.map((condition) => (
                <tr key={condition.id}><td>{condition.description}</td><td>{label(condition.status)}</td><td>{condition.dueDate ?? "—"}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className={styles.reportBody}>No client-visible recommendation conditions were included in this snapshot.</p>}
          <h3 className={styles.reportSubheading}>Next steps</h3>
          <p className={styles.reportBody}>{report.recommendation.nextSteps ?? "No next steps were recorded in this recommendation version."}</p>
        </section>

        <section className={styles.reportSection}>
          <div className={styles.reportSectionHeading}><span>•</span><h2>Supporting Evidence</h2></div>
          <div className={styles.reportTableWrap}>
            <table className={styles.reportTable}>
              <thead><tr><th>Evidence</th><th>Source</th><th>Date</th><th>Confidence</th></tr></thead>
              <tbody>
                {report.evidence.length ? report.evidence.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong>{item.description ? <small>{item.description}</small> : null}</td>
                    <td>{label(item.sourceType)}</td>
                    <td>{item.observationDate ?? item.effectiveDate ?? "—"}</td>
                    <td>{item.confidence ? label(item.confidence) : "—"}</td>
                  </tr>
                )) : <tr><td colSpan={4}>No client-visible evidence records were included in this snapshot.</td></tr>}
              </tbody>
            </table>
          </div>

          <h3 className={styles.reportSubheading}>Referenced documents</h3>
          <div className={styles.reportTableWrap}>
            <table className={styles.reportTable}>
              <thead><tr><th>Document</th><th>Category</th><th>Version</th><th>Source date</th></tr></thead>
              <tbody>
                {report.documents.length ? report.documents.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong>{item.originalFilename ? <small>{item.originalFilename}</small> : null}</td>
                    <td>{label(item.category)}</td>
                    <td>{item.versionNumber ? `v${item.versionNumber}` : "—"}</td>
                    <td>{item.sourceDate ?? "—"}</td>
                  </tr>
                )) : <tr><td colSpan={4}>No client-visible documents were included in this snapshot.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`${styles.reportSection} ${styles.versionRecord}`}>
          <div className={styles.reportSectionHeading}><span>•</span><h2>Decision Version Record</h2></div>
          <p>This record identifies the exact analytical versions used to compose this client report. Later project updates do not rewrite this snapshot.</p>
          <dl className={styles.versionGrid}>
            <div><dt>Report ID</dt><dd><code>{report.reportId}</code></dd></div>
            <div><dt>Generated</dt><dd>{report.generatedAt}</dd></div>
            <div><dt>Decision snapshot</dt><dd><code>{report.decision.snapshotId}</code></dd></div>
            <div><dt>Recommendation</dt><dd><code>{report.decision.recommendationId}</code> · v{report.decision.recommendationVersion}</dd></div>
            <div><dt>Requirements</dt><dd><code>{report.decision.requirementsVersionId}</code></dd></div>
            <div><dt>Scenario</dt><dd><code>{report.decision.scenarioVersionId ?? "Not referenced"}</code></dd></div>
            <div><dt>Scorecard</dt><dd><code>{report.decision.scorecardVersionId ?? "Not referenced"}</code></dd></div>
            <div><dt>Comparison</dt><dd><code>{report.decision.comparisonVersionId ?? "Not referenced"}</code></dd></div>
            <div><dt>Cost model</dt><dd><code>{report.decision.costModelVersionId ?? "Not referenced"}</code></dd></div>
            <div><dt>Incentive model</dt><dd><code>{report.decision.incentiveModelVersionId ?? "Not referenced"}</code></dd></div>
            <div><dt>Risk snapshot</dt><dd><code>{report.decision.riskSnapshotId ?? "Not referenced"}</code></dd></div>
            <div><dt>Candidate snapshot</dt><dd><code>{report.decision.candidateSnapshotId ?? "Not referenced"}</code></dd></div>
            <div><dt>Site visit snapshot</dt><dd><code>{report.decision.siteVisitSnapshotId ?? "Not referenced"}</code></dd></div>
          </dl>
        </section>

        <footer className={styles.reportFooter}>AccelSSA · Client Recommendation · {report.project.name}</footer>
      </main>
    </div>
  );
}
