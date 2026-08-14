"use client";

import { useMemo, useState } from "react";
import {
  DecisionAnalyticsEngine,
  type OverrideRecord,
  type Scenario as AnalyticsScenario,
  type ScreeningCandidateResult,
  type SensitivityVariant,
} from "@accelssa/decision-analytics";
import { buildAnalyticsScenario } from "@/domains/decision-analytics/adapter";
import type { AnalysisWorkspaceBundle } from "@/domains/decision-analytics/contracts";
import styles from "./analysis-workspace.module.css";

type InspectorTab = "qualification" | "score" | "explain" | "sensitivity" | "override" | "history";
type QualificationFilter = "ALL" | ScreeningCandidateResult["qualification"]["calculatedStatus"];
type OverrideTarget = "qualification" | "overall_score" | "rank";

interface OverridePreview {
  target: OverrideTarget;
  calculatedValue: unknown;
  effectiveValue: unknown;
  rationale: string;
}

function statusClass(status: ScreeningCandidateResult["qualification"]["calculatedStatus"]): string {
  if (status === "QUALIFIED") return `${styles.status} ${styles.statusQualified}`;
  if (status === "MARGINAL") return `${styles.status} ${styles.statusMarginal}`;
  if (status === "DISQUALIFIED") return `${styles.status} ${styles.statusDisqualified}`;
  return `${styles.status} ${styles.statusUnknown}`;
}

function formatScore(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
}

function formatValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return "Unknown";
  const rendered = typeof value === "number"
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)
    : String(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

function targetLabel(evaluation: ScreeningCandidateResult["qualification"]["evaluations"][number]): string {
  if (evaluation.minValue !== undefined || evaluation.maxValue !== undefined) {
    return `${evaluation.minValue ?? "−∞"}–${evaluation.maxValue ?? "+∞"}${evaluation.unit ? ` ${evaluation.unit}` : ""}`;
  }
  return formatValue(evaluation.targetValue, evaluation.unit);
}

function rankSort(left: ScreeningCandidateResult, right: ScreeningCandidateResult): number {
  if (left.rank === null && right.rank === null) return left.candidateName.localeCompare(right.candidateName);
  if (left.rank === null) return 1;
  if (right.rank === null) return -1;
  return left.rank - right.rank || left.candidateName.localeCompare(right.candidateName);
}

function makeWeightVariant(scenario: AnalyticsScenario, categoryId: string): SensitivityVariant | null {
  const selected = scenario.categories.find((category) => category.id === categoryId);
  if (!selected || scenario.categories.length < 2 || selected.weight >= 0.9) return null;

  const selectedWeight = Math.min(0.9, selected.weight + 0.1);
  const originalOtherWeight = 1 - selected.weight;
  const newOtherWeight = 1 - selectedWeight;
  if (originalOtherWeight <= 0) return null;

  return {
    id: `${categoryId}-plus-10`,
    label: `${selected.label} +10 pts`,
    categoryWeightOverrides: Object.fromEntries(
      scenario.categories.map((category) => [
        category.id,
        category.id === selected.id
          ? selectedWeight
          : category.weight * (newOtherWeight / originalOtherWeight),
      ]),
    ),
  };
}

function DecisionSeparation({
  result,
  risk,
  consultantJudgment,
  clientDecision,
  overridePreview,
}: {
  result: ScreeningCandidateResult;
  risk?: string | null;
  consultantJudgment?: string | null;
  clientDecision?: string | null;
  overridePreview: OverridePreview | null;
}) {
  const cells = [
    ["Qualification", result.qualification.calculatedStatus.replaceAll("_", " ")],
    ["Score", formatScore(result.score.calculatedScore)],
    ["Risk", risk ?? "Not supplied"],
    ["Consultant judgment", overridePreview ? "Working override preview" : consultantJudgment ?? "Not recorded"],
    ["Client decision", clientDecision ?? "Not recorded"],
  ];
  return (
    <div className={styles.decisionStrip} aria-label="Separate decision concepts">
      {cells.map(([label, value]) => (
        <div className={styles.decisionCell} key={label}>
          <span className={styles.decisionLabel}>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function AnalysisWorkspace({ bundle }: { bundle: AnalysisWorkspaceBundle }) {
  const engine = useMemo(() => new DecisionAnalyticsEngine(), []);
  const [scenarioId, setScenarioId] = useState(bundle.scenarios[0]?.id ?? "base");
  const [qualificationFilter, setQualificationFilter] = useState<QualificationFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState(bundle.candidates[0]?.id ?? "");
  const [tab, setTab] = useState<InspectorTab>("qualification");
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget>("qualification");
  const [overrideValue, setOverrideValue] = useState("QUALIFIED_WITH_CONDITION");
  const [overrideRationale, setOverrideRationale] = useState("");
  const [overridePreview, setOverridePreview] = useState<OverridePreview | null>(null);

  const scenarioDefinition = bundle.scenarios.find((scenario) => scenario.id === scenarioId);
  const built = useMemo(
    () => buildAnalyticsScenario(bundle.requirementSetVersion, bundle.criteria, scenarioDefinition),
    [bundle.criteria, bundle.requirementSetVersion, scenarioDefinition],
  );
  const screeningInput = useMemo(() => ({
    runId: `workspace:${bundle.projectId}:${built.scenario.id}`,
    tenantId: bundle.tenantId,
    projectId: bundle.projectId,
    asOf: bundle.requirementSetVersion.activatedAt ?? bundle.requirementSetVersion.createdAt,
    requirements: built.requirements,
    scenario: built.scenario,
    candidates: bundle.candidates,
  }), [built, bundle]);
  const run = useMemo(() => engine.runScreening(screeningInput), [engine, screeningInput]);
  const resultByCandidate = useMemo(
    () => new Map(run.results.map((result) => [result.candidateId, result])),
    [run.results],
  );
  const metricIds = useMemo(() => [...new Set([
    ...built.requirements.map((requirement) => requirement.metricId),
    ...built.scenario.categories.flatMap((category) => category.factors.map((factor) => factor.metricId)),
  ])], [built]);
  const comparison = useMemo(
    () => engine.buildComparison(run, bundle.candidates, metricIds),
    [bundle.candidates, engine, metricIds, run],
  );
  const sensitivityVariants = useMemo(
    () => built.scenario.categories
      .slice(0, 3)
      .map((category) => makeWeightVariant(built.scenario, category.id))
      .filter((variant): variant is SensitivityVariant => variant !== null),
    [built.scenario],
  );
  const sensitivity = useMemo(
    () => sensitivityVariants.length ? engine.runSensitivity(screeningInput, sensitivityVariants) : null,
    [engine, screeningInput, sensitivityVariants],
  );

  const rows = useMemo(() => comparison.rows
    .filter((row) => {
      const result = resultByCandidate.get(row.candidateId);
      if (!result) return false;
      if (qualificationFilter !== "ALL" && result.qualification.calculatedStatus !== qualificationFilter) return false;
      return !search.trim() || row.candidateName.toLowerCase().includes(search.trim().toLowerCase());
    })
    .sort((left, right) => rankSort(resultByCandidate.get(left.candidateId)!, resultByCandidate.get(right.candidateId)!)),
  [comparison.rows, qualificationFilter, resultByCandidate, search]);

  const selectedResult = resultByCandidate.get(selectedCandidateId)
    ?? resultByCandidate.get(rows[0]?.candidateId ?? "")
    ?? run.results[0];
  const selectedCandidate = bundle.candidates.find((candidate) => candidate.id === selectedResult?.candidateId);

  if (!selectedResult || !selectedCandidate) {
    return <div className={styles.empty}><h2>No candidates available</h2><p>The selected analysis source contains no candidates.</p></div>;
  }

  const summary = {
    qualified: run.results.filter((result) => result.qualification.calculatedStatus === "QUALIFIED").length,
    marginal: run.results.filter((result) => result.qualification.calculatedStatus === "MARGINAL").length,
    disqualified: run.results.filter((result) => result.qualification.calculatedStatus === "DISQUALIFIED").length,
    unknown: run.results.filter((result) => result.qualification.calculatedStatus === "INSUFFICIENT_DATA").length,
  };
  const mandatory = selectedResult.qualification.evaluations.filter((evaluation) => evaluation.classification === "mandatory");
  const sensitivityRows = sensitivity?.variants.map((variant) => ({
    variant,
    delta: variant.deltas.find((entry) => entry.candidateId === selectedResult.candidateId),
  })) ?? [];

  function changeScenario(nextScenarioId: string) {
    setScenarioId(nextScenarioId);
    setOverridePreview(null);
  }

  function previewOverride() {
    if (overrideRationale.trim().length < 8) return;
    let calculatedValue: unknown;
    let effectiveValue: unknown = overrideValue;

    if (overrideTarget === "qualification") {
      calculatedValue = selectedResult.qualification.calculatedStatus;
    } else if (overrideTarget === "overall_score") {
      calculatedValue = selectedResult.score.calculatedScore;
      effectiveValue = overrideValue.trim() === "" ? null : Number(overrideValue);
      if (typeof effectiveValue === "number" && (!Number.isFinite(effectiveValue) || effectiveValue < 0 || effectiveValue > 100)) return;
    } else {
      calculatedValue = selectedResult.rank;
      effectiveValue = overrideValue.trim() === "" ? null : Number(overrideValue);
      if (typeof effectiveValue === "number" && (!Number.isInteger(effectiveValue) || effectiveValue < 1)) return;
    }

    const override: OverrideRecord<unknown> = {
      id: `working:${selectedResult.candidateId}:${overrideTarget}`,
      tenantId: bundle.tenantId,
      projectId: bundle.projectId,
      candidateId: selectedResult.candidateId,
      target: overrideTarget,
      originalValue: calculatedValue,
      overrideValue: effectiveValue,
      rationale: overrideRationale.trim(),
      authorId: "current-user",
      createdAt: new Date().toISOString(),
      evidenceIds: [],
    };
    const resolved = engine.resolveOverride(calculatedValue, override);
    setOverridePreview({
      target: overrideTarget,
      calculatedValue: resolved.calculatedValue,
      effectiveValue: resolved.effectiveValue,
      rationale: override.rationale,
    });
  }

  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <select className={styles.control} value={scenarioId} onChange={(event) => changeScenario(event.target.value)} aria-label="Scenario">
            {bundle.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
          </select>
          <select className={styles.control} value={qualificationFilter} onChange={(event) => setQualificationFilter(event.target.value as QualificationFilter)} aria-label="Qualification filter">
            <option value="ALL">All qualification states</option>
            <option value="QUALIFIED">Qualified</option>
            <option value="MARGINAL">Marginal</option>
            <option value="DISQUALIFIED">Disqualified</option>
            <option value="INSUFFICIENT_DATA">Insufficient data</option>
          </select>
          <input className={`${styles.control} ${styles.search}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter candidates" aria-label="Filter candidates" />
        </div>
        <div className={styles.toolbarGroup}>
          <span className={styles.contextBadge}>Requirements v{bundle.requirementSetVersion.version}</span>
          <span className={styles.contextBadge}>Engine {run.engineVersion}</span>
          {bundle.dataMode === "SAMPLE" ? <span className={styles.sampleBadge}>Sample data</span> : null}
        </div>
      </div>

      {bundle.dataMode === "SAMPLE" ? <div className={styles.notice}>{bundle.sourceNotice}</div> : null}
      {built.warnings.map((warning) => <div className={styles.notice} key={warning}>{warning}</div>)}

      <div className={styles.summaryStrip} aria-label="Analysis summary">
        {[
          [run.candidateCount, "Candidates"],
          [summary.qualified, "Qualified"],
          [summary.marginal, "Marginal"],
          [summary.disqualified, "Disqualified"],
          [summary.unknown, "Insufficient data"],
        ].map(([value, label]) => (
          <div className={styles.summaryItem} key={String(label)}><span className={styles.summaryValue}>{value}</span><span className={styles.summaryLabel}>{label}</span></div>
        ))}
      </div>

      <div className={styles.layout}>
        <section className={styles.matrix} aria-label="Candidate comparison matrix">
          <div className={styles.matrixHeader}>
            <div><h2>Candidate comparison</h2><p>Rank is calculated only for qualified or marginal candidates with complete scoring inputs.</p></div>
            <span className={styles.contextBadge}>{built.scenario.name}</span>
          </div>
          <div className={styles.matrixScroller}>
            <table className={styles.matrixTable}>
              <thead><tr><th>Rank</th><th>Candidate</th><th>Qualification</th><th>Mandatory</th><th>Score</th>{built.scenario.categories.map((category) => <th key={category.id}>{category.label}</th>)}<th>Complete</th></tr></thead>
              <tbody>
                {rows.map((row) => {
                  const result = resultByCandidate.get(row.candidateId)!;
                  const required = result.qualification.mandatorySummary;
                  return (
                    <tr key={row.candidateId} className={row.candidateId === selectedResult.candidateId ? styles.selectedRow : undefined} onClick={() => { setSelectedCandidateId(row.candidateId); setOverridePreview(null); }}>
                      <td>{row.rank ?? "—"}</td>
                      <td className={styles.candidateName}>{row.candidateName}<span className={styles.subtle}>{row.candidateKind}</span></td>
                      <td><span className={statusClass(result.qualification.calculatedStatus)}>{result.qualification.calculatedStatus.replaceAll("_", " ")}</span></td>
                      <td className={styles.mandatoryCell}><span className={styles.good}>{required.passed} pass</span>{" · "}<span className={required.failed ? styles.bad : undefined}>{required.failed} fail</span>{" · "}<span className={required.unknown ? styles.unknown : undefined}>{required.unknown} unknown</span></td>
                      <td className={styles.scoreCell}><div className={styles.scoreLine}><span className={styles.scoreValue}>{formatScore(row.score)}</span><span className={styles.scoreTrack}><span className={styles.scoreFill} style={{ width: `${Math.max(0, Math.min(100, row.score ?? 0))}%` }} /></span></div></td>
                      {built.scenario.categories.map((category) => <td key={category.id}>{formatScore(result.score.categories.find((entry) => entry.categoryId === category.id)?.score ?? null)}</td>)}
                      <td>{row.completeness.toFixed(0)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className={styles.inspector} aria-label="Candidate inspector">
          <div className={styles.inspectorHeader}>
            <div><h2>{selectedResult.candidateName}</h2><p>Rank {selectedResult.rank ?? "—"} · score {formatScore(selectedResult.score.calculatedScore)}</p></div>
            <span className={statusClass(selectedResult.qualification.calculatedStatus)}>{selectedResult.qualification.calculatedStatus.replaceAll("_", " ")}</span>
          </div>
          <div className={styles.inspectorTabs} role="tablist" aria-label="Candidate analysis details">
            {(["qualification", "score", "explain", "sensitivity", "override", "history"] as InspectorTab[]).map((value) => <button key={value} className={`${styles.tab} ${tab === value ? styles.activeTab : ""}`} type="button" onClick={() => setTab(value)}>{value[0]!.toUpperCase() + value.slice(1)}</button>)}
          </div>
          <div className={styles.inspectorBody}>
            <DecisionSeparation result={selectedResult} risk={selectedCandidate.decisionContext?.risk} consultantJudgment={selectedCandidate.decisionContext?.consultantJudgment} clientDecision={selectedCandidate.decisionContext?.clientDecision} overridePreview={overridePreview} />

            {tab === "qualification" ? (
              <table className={styles.detailTable}>
                <thead><tr><th>Mandatory requirement</th><th>Actual</th><th>Target</th><th>Result</th></tr></thead>
                <tbody>{mandatory.map((evaluation) => <tr key={evaluation.requirementId}><td>{evaluation.metricId}<span className={styles.subtle}>{evaluation.sourceId ?? "No source"}{evaluation.observationDate ? ` · ${evaluation.observationDate}` : ""}</span></td><td>{formatValue(evaluation.actualValue, evaluation.unit)}</td><td>{targetLabel(evaluation)}</td><td className={evaluation.status === "PASS" ? styles.good : evaluation.status === "UNKNOWN" ? styles.unknown : styles.bad}>{evaluation.status}</td></tr>)}</tbody>
              </table>
            ) : null}

            {tab === "score" ? selectedResult.score.categories.map((category) => (
              <details className={styles.category} key={category.categoryId} open>
                <summary><span>{category.categoryLabel}</span><span>{formatScore(category.score)}</span><span>{(category.weight * 100).toFixed(0)}%</span></summary>
                <div className={styles.categoryBody}><table className={styles.detailTable}><thead><tr><th>Factor</th><th>Raw</th><th>Normalized</th><th>Weight</th></tr></thead><tbody>{category.factors.map((factor) => <tr key={factor.factorId}><td>{factor.factorLabel}</td><td>{formatValue(factor.rawValue)}</td><td>{formatScore(factor.normalizedScore)}</td><td>{(factor.weight * 100).toFixed(0)}%</td></tr>)}</tbody></table></div>
              </details>
            )) : null}

            {tab === "explain" ? selectedResult.score.categories.flatMap((category) => category.factors.map((factor) => ({ category, factor }))).map(({ category, factor }) => (
              <details className={styles.category} key={factor.factorId}>
                <summary><span>{factor.factorLabel}</span><span>{formatScore(factor.normalizedScore)}</span><span>{factor.normalizationMethod}</span></summary>
                <div className={styles.categoryBody}><dl className={styles.metaGrid}><dt>Category</dt><dd>{category.categoryLabel}</dd><dt>Metric</dt><dd>{factor.metricId}</dd><dt>Raw value</dt><dd>{formatValue(factor.rawValue)}</dd><dt>Normalization</dt><dd>{factor.normalizationMethod}</dd><dt>Normalized score</dt><dd>{formatScore(factor.normalizedScore)}</dd><dt>Factor weight</dt><dd>{(factor.weight * 100).toFixed(1)}%</dd><dt>Contribution</dt><dd>{formatScore(factor.weightedContribution, 2)}</dd><dt>Source</dt><dd>{factor.lineage.sourceId ?? "Unavailable"}</dd><dt>Dataset</dt><dd>{factor.lineage.sourceDataset ?? "Unavailable"}</dd><dt>Observation date</dt><dd>{factor.lineage.observationDate ?? "Unavailable"}</dd><dt>Retrieved</dt><dd>{factor.lineage.retrievedAt ?? "Unavailable"}</dd></dl></div>
              </details>
            )) : null}

            {tab === "sensitivity" ? <div className={styles.sensitivityList}>{sensitivityRows.length ? sensitivityRows.map(({ variant, delta }) => <div className={styles.sensitivityRow} key={variant.variantId}><div><strong>{variant.label}</strong><span className={styles.subtle}>Engine-calculated weight perturbation</span></div><span>Score {formatScore(delta?.variantScore ?? null)}</span><span>Rank {delta?.variantRank ?? "—"}{delta?.rankDelta ? ` (${delta.rankDelta > 0 ? "+" : ""}${delta.rankDelta})` : ""}</span></div>) : <p>No valid sensitivity variants are available for this scenario.</p>}</div> : null}

            {tab === "override" ? (
              <div className={styles.overrideForm}>
                <div className={styles.notice}>{bundle.canPersistOverrides ? "Override persistence is available." : "Authoritative override persistence is not configured. This is a working preview only; no save is claimed."}</div>
                <div className={styles.overrideGrid}>
                  <label>Target<select className={styles.control} value={overrideTarget} onChange={(event) => { const target = event.target.value as OverrideTarget; setOverrideTarget(target); setOverrideValue(target === "qualification" ? "QUALIFIED_WITH_CONDITION" : ""); setOverridePreview(null); }}><option value="qualification">Qualification</option><option value="overall_score">Overall score</option><option value="rank">Rank</option></select></label>
                  <label>Override value{overrideTarget === "qualification" ? <select className={styles.control} value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)}><option value="QUALIFIED_WITH_CONDITION">Qualified with condition</option><option value="QUALIFIED">Qualified</option><option value="MARGINAL">Marginal</option><option value="DISQUALIFIED">Disqualified</option></select> : <input className={styles.control} value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)} inputMode="decimal" placeholder={overrideTarget === "rank" ? "Rank" : "0–100"} />}</label>
                </div>
                <label>Rationale<textarea className={styles.control} value={overrideRationale} onChange={(event) => setOverrideRationale(event.target.value)} placeholder="Required: explain why professional judgment differs from the calculated result." /></label>
                <button type="button" className={styles.button} onClick={previewOverride} disabled={overrideRationale.trim().length < 8}>Preview effective result</button>
                {overridePreview ? <div className={styles.preview}><strong>Working override preview</strong><br />Calculated: {String(overridePreview.calculatedValue ?? "—")} → Effective: {String(overridePreview.effectiveValue ?? "—")}<br />Rationale: {overridePreview.rationale}<br /><strong>Not persisted.</strong> The calculated value remains intact.</div> : null}
              </div>
            ) : null}

            {tab === "history" ? <div className={styles.historyList}><div className={styles.historyRow}><div><strong>Current calculation</strong><span className={styles.subtle}>Requirements v{run.requirementsVersion} · {built.scenario.name}</span></div><span>{new Date(run.asOf).toLocaleString()}</span><span>Engine {run.engineVersion}</span></div>{bundle.historicalSnapshots.map((snapshot) => { const historical = snapshot.run.results.find((result) => result.candidateId === selectedResult.candidateId); return <div className={styles.historyRow} key={snapshot.snapshotId}><div><strong>{snapshot.reason}</strong><span className={styles.subtle}>Requirements v{snapshot.run.requirementsVersion} · scenario {snapshot.run.scenarioId}</span></div><span>Score {formatScore(historical?.score.calculatedScore ?? null)} · rank {historical?.rank ?? "—"}</span><span>{new Date(snapshot.createdAt).toLocaleDateString()}</span></div>; })}</div> : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
