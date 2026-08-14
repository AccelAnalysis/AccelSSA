"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DecisionAnalyticsEngine,
  type OverrideRecord,
  type Scenario as AnalyticsScenario,
  type ScreeningCandidateResult,
  type SensitivityVariant,
} from "../../../packages/decision-analytics/src/index";
import { buildAnalyticsScenario } from "@/domains/decision-analytics/adapter";
import type { AnalysisWorkspaceBundle } from "@/domains/decision-analytics/contracts";
import styles from "./analysis-workspace.module.css";

type InspectorTab = "qualification" | "score" | "explain" | "sensitivity" | "override" | "history";
type QualificationFilter = "ALL" | "QUALIFIED" | "MARGINAL" | "DISQUALIFIED" | "INSUFFICIENT_DATA";
type OverridePreview = {
  target: "qualification" | "overall_score" | "rank";
  calculatedValue: unknown;
  effectiveValue: unknown;
  rationale: string;
};

function statusClass(status: ScreeningCandidateResult["qualification"]["calculatedStatus"]): string {
  switch (status) {
    case "QUALIFIED":
      return `${styles.status} ${styles.statusQualified}`;
    case "MARGINAL":
      return `${styles.status} ${styles.statusMarginal}`;
    case "DISQUALIFIED":
      return `${styles.status} ${styles.statusDisqualified}`;
    case "INSUFFICIENT_DATA":
      return `${styles.status} ${styles.statusUnknown}`;
  }
}

function formatNumber(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
}

function formatValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined) return "Unknown";
  const rendered = typeof value === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value) : String(value);
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
  if (left.rank !== right.rank) return left.rank - right.rank;
  return left.candidateName.localeCompare(right.candidateName);
}

function makeWeightVariant(scenario: AnalyticsScenario, categoryId: string, delta: number): SensitivityVariant | null {
  const target = scenario.categories.find((category) => category.id === categoryId);
  if (!target || scenario.categories.length < 2) return null;
  const targetWeight = Math.min(0.9, target.weight + delta);
  const oldOtherWeight = 1 - target.weight;
  if (oldOtherWeight <= 0) return null;
  const newOtherWeight = 1 - targetWeight;
  const overrides = Object.fromEntries(
    scenario.categories.map((category) => [
      category.id,
      category.id === categoryId ? targetWeight : category.weight * (newOtherWeight / oldOtherWeight),
    ]),
  );
  return {
    id: `${categoryId}-plus-${Math.round(delta * 100)}`,
    label: `${target.label} +${Math.round(delta * 100)} pts`,
    categoryWeightOverrides: overrides,
  };
}

export function AnalysisWorkspace({ bundle }: { bundle: AnalysisWorkspaceBundle }) {
  const engine = useMemo(() => new DecisionAnalyticsEngine(), []);
  const [scenarioId, setScenarioId] = useState(bundle.scenarios[0]?.id ?? "base");
  const scenarioDefinition = bundle.scenarios.find((scenario) => scenario.id === scenarioId);
  const built = useMemo(
    () => buildAnalyticsScenario(bundle.requirementSetVersion, bundle.criteria, scenarioDefinition),
    [bundle.requirementSetVersion, bundle.criteria, scenarioDefinition],
  );

  const screeningInput = useMemo(
    () => ({
      runId: `workspace:${bundle.projectId}:${built.scenario.id}`,
      tenantId: bundle.tenantId,
      projectId: bundle.projectId,
      asOf: new Date().toISOString(),
      requirements: built.requirements,
      scenario: built.scenario,
      candidates: bundle.candidates,
    }),
    [bundle, built],
  );

  const run = useMemo(() => engine.runScreening(screeningInput), [engine, screeningInput]);
  const resultByCandidate = useMemo(
    () => new Map(run.results.map((result) => [result.candidateId, result])),
    [run],
  );
  const metricIds = useMemo(
    () => [
      ...new Set([
        ...built.requirements.map((requirement) => requirement.metricId),
        ...built.scenario.categories.flatMap((category) => category.factors.map((factor) => factor.metricId)),
      ]),
    ],
    [built],
  );
  const comparison = useMemo(
    () => engine.buildComparison(run, bundle.candidates, metricIds),
    [engine, run, bundle.candidates, metricIds],
  );

  const sensitivityVariants = useMemo(
    () => built.scenario.categories
      .slice(0, 3)
      .map((category) => makeWeightVariant(built.scenario, category.id, 0.1))
      .filter((variant): variant is SensitivityVariant => variant !== null),
    [built.scenario],
  );
  const sensitivity = useMemo(
    () => sensitivityVariants.length > 0 ? engine.runSensitivity(screeningInput, sensitivityVariants) : null,
    [engine, screeningInput, sensitivityVariants],
  );

  const [search, setSearch] = useState("");
  const [qualificationFilter, setQualificationFilter] = useState<QualificationFilter>("ALL");
  const [selectedCandidateId, setSelectedCandidateId] = useState(run.results[0]?.candidateId ?? "");
  const [tab, setTab] = useState<InspectorTab>("qualification");
  const [overrideTarget, setOverrideTarget] = useState<"qualification" | "overall_score" | "rank">("qualification");
  const [overrideValue, setOverrideValue] = useState("QUALIFIED_WITH_CONDITION");
  const [overrideRationale, setOverrideRationale] = useState("");
  const [overridePreview, setOverridePreview] = useState<OverridePreview | null>(null);

  useEffect(() => {
    setOverridePreview(null);
    setOverrideRationale("");
  }, [scenarioId, selectedCandidateId]);

  const rows = useMemo(() => comparison.rows
    .filter((row) => {
      const result = resultByCandidate.get(row.candidateId);
      if (!result) return false;
      if (qualificationFilter !== "ALL" && result.qualification.calculatedStatus !== qualificationFilter) return false;
      if (search.trim() && !row.candidateName.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    })
    .sort((left, right) => rankSort(resultByCandidate.get(left.candidateId)!, resultByCandidate.get(right.candidateId)!)),
  [comparison.rows, qualificationFilter, search, resultByCandidate]);

  useEffect(() => {
    if (rows.length > 0 && !rows.some((row) => row.candidateId === selectedCandidateId)) {
      setSelectedCandidateId(rows[0]!.candidateId);
    }
  }, [rows, selectedCandidateId]);

  const selectedResult = resultByCandidate.get(selectedCandidateId) ?? run.results[0];
  const selectedCandidate = bundle.candidates.find((candidate) => candidate.id === selectedResult?.candidateId);

  const summary = useMemo(() => ({
    qualified: run.results.filter((result) => result.qualification.calculatedStatus === "QUALIFIED").length,
    marginal: run.results.filter((result) => result.qualification.calculatedStatus === "MARGINAL").length,
    disqualified: run.results.filter((result) => result.qualification.calculatedStatus === "DISQUALIFIED").length,
    unknown: run.results.filter((result) => result.qualification.calculatedStatus === "INSUFFICIENT_DATA").length,
  }), [run]);

  function previewOverride() {
    if (!selectedResult || overrideRationale.trim().length < 8) return;
    let calculatedValue: unknown;
    let effectiveInput: unknown = overrideValue;
    if (overrideTarget === "qualification") {
      calculatedValue = selectedResult.qualification.calculatedStatus;
    } else if (overrideTarget === "overall_score") {
      calculatedValue = selectedResult.score.calculatedScore;
      effectiveInput = overrideValue.trim() === "" ? null : Number(overrideValue);
      if (typeof effectiveInput === "number" && (!Number.isFinite(effectiveInput) || effectiveInput < 0 || effectiveInput > 100)) return;
    } else {
      calculatedValue = selectedResult.rank;
      effectiveInput = overrideValue.trim() === "" ? null : Number(overrideValue);
      if (typeof effectiveInput === "number" && (!Number.isInteger(effectiveInput) || effectiveInput < 1)) return;
    }

    const record: OverrideRecord<unknown> = {
      id: `working:${selectedResult.candidateId}:${overrideTarget}`,
      tenantId: bundle.tenantId,
      projectId: bundle.projectId,
      candidateId: selectedResult.candidateId,
      target: overrideTarget,
      originalValue: calculatedValue,
      overrideValue: effectiveInput,
      rationale: overrideRationale.trim(),
      authorId: "current-user",
      createdAt: new Date().toISOString(),
      evidenceIds: [],
    };
    const resolved = engine.resolveOverride(calculatedValue, record);
    setOverridePreview({
      target: overrideTarget,
      calculatedValue: resolved.calculatedValue,
      effectiveValue: resolved.effectiveValue,
      rationale: record.rationale,
    });
  }

  if (!selectedResult || !selectedCandidate) {
    return <div className={styles.empty}><h2>No candidates available</h2><p>The selected analysis source contains no candidates.</p></div>;
  }

  const mandatoryEvaluations = selectedResult.qualification.evaluations.filter((evaluation) => evaluation.classification === "mandatory");
  const selectedSensitivity = sensitivity?.variants.map((variant) => ({
    variant,
    delta: variant.deltas.find((entry) => entry.candidateId === selectedResult.candidateId),
  })) ?? [];

  return (
    <div className={styles.workspace}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <label>
            <span className="sr-only">Scenario</span>
            <select className={styles.control} value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
              {bundle.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
            </select>
          </label>
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
        <div className={styles.summaryItem}><span className={styles.summaryValue}>{run.candidateCount}</span><span className={styles.summaryLabel}>Candidates</span></div>
        <div className={styles.summaryItem}><span className={styles.summaryValue}>{summary.qualified}</span><span className={styles.summaryLabel}>Qualified</span></div>
        <div className={styles.summaryItem}><span className={styles.summaryValue}>{summary.marginal}</span><span className={styles.summaryLabel}>Marginal</span></div>
        <div className={styles.summaryItem}><span className={styles.summaryValue}>{summary.disqualified}</span><span className={styles.summaryLabel}>Disqualified</span></div>
        <div className={styles.summaryItem}><span className={styles.summaryValue}>{summary.unknown}</span><span className={styles.summaryLabel}>Insufficient data</span></div>
      </div>

      <div className={styles.layout}>
        <section className={styles.matrix} aria-label="Candidate comparison matrix">
          <div className={styles.matrixHeader}>
            <div><h2>Candidate comparison</h2><p>Calculated rank applies only to qualified or marginal candidates with complete scoring inputs.</p></div>
            <span className={styles.contextBadge}>{built.scenario.name}</span>
          </div>
          <div className={styles.matrixScroller}>
            <table className={styles.matrixTable}>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Candidate</th>
                  <th>Qualification</th>
                  <th>Mandatory</th>
                  <th>Score</th>
                  {built.scenario.categories.map((category) => <th key={category.id}>{category.label}</th>)}
                  <th>Complete</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const result = resultByCandidate.get(row.candidateId)!;
                  const mandatory = result.qualification.mandatorySummary;
                  return (
                    <tr key={row.candidateId} className={row.candidateId === selectedResult.candidateId ? styles.selectedRow : undefined} onClick={() => setSelectedCandidateId(row.candidateId)}>
                      <td>{row.rank ?? "—"}</td>
                      <td className={styles.candidateName}>{row.candidateName}<span className={styles.subtle}>{row.candidateKind}</span></td>
                      <td><span className={statusClass(result.qualification.calculatedStatus)}>{result.qualification.calculatedStatus.replaceAll("_", " ")}</span></td>
                      <td className={styles.mandatoryCell}>
                        <span className={styles.good}>{mandatory.passed} pass</span>{" · "}
                        <span className={mandatory.failed ? styles.bad : undefined}>{mandatory.failed} fail</span>{" · "}
                        <span className={mandatory.unknown ? styles.unknown : undefined}>{mandatory.unknown} unknown</span>
                      </td>
                      <td className={styles.scoreCell}>
                        <div className={styles.scoreLine}><span className={styles.scoreValue}>{formatNumber(row.score)}</span><span className={styles.scoreTrack}><span className={styles.scoreFill} style={{ width: `${Math.max(0, Math.min(100, row.score ?? 0))}%` }} /></span></div>
                      </td>
                      {built.scenario.categories.map((category) => {
                        const categoryResult = result.score.categories.find((entry) => entry.categoryId === category.id);
                        return <td key={category.id}>{formatNumber(categoryResult?.score ?? null)}</td>;
                      })}
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
            <div><h2>{selectedResult.candidateName}</h2><p>Rank {selectedResult.rank ?? "—"} · calculated score {formatNumber(selectedResult.score.calculatedScore)}</p></div>
            <span className={statusClass(selectedResult.qualification.calculatedStatus)}>{selectedResult.qualification.calculatedStatus.replaceAll("_", " ")}</span>
          </div>

          <div className={styles.inspectorTabs} role="tablist" aria-label="Candidate analysis details">
            {([
              ["qualification", "Qualification"],
              ["score", "Score"],
              ["explain", "Explain"],
              ["sensitivity", "Sensitivity"],
              ["override", "Override"],
              ["history", "History"],
            ] as const).map(([value, label]) => (
              <button key={value} className={`${styles.tab} ${tab === value ? styles.activeTab : ""}`} type="button" onClick={() => setTab(value)}>{label}</button>
            ))}
          </div>

          <div className={styles.inspectorBody}>
            <div className={styles.decisionStrip} aria-label="Separate decision concepts">
              <div className={styles.decisionCell}><span className={styles.decisionLabel}>Qualification</span><strong>{selectedResult.qualification.calculatedStatus.replaceAll("_", " ")}</strong></div>
              <div className={styles.decisionCell}><span className={styles.decisionLabel}>Score</span><strong>{formatNumber(selectedResult.score.calculatedScore)}</strong></div>
              <div className={styles.decisionCell}><span className={styles.decisionLabel}>Risk</span><strong>{selectedCandidate.decisionContext?.risk ?? "Not supplied"}</strong></div>
              <div className={styles.decisionCell}><span className={styles.decisionLabel}>Consultant judgment</span><strong>{overridePreview ? "Working override preview" : selectedCandidate.decisionContext?.consultantJudgment ?? "Not recorded"}</strong></div>
              <div className={styles.decisionCell}><span className={styles.decisionLabel}>Client decision</span><strong>{selectedCandidate.decisionContext?.clientDecision ?? "Not recorded"}</strong></div>
            </div>

            {tab === "qualification" ? (
              <table className={styles.detailTable}>
                <thead><tr><th>Mandatory requirement</th><th>Actual</th><th>Target</th><th>Result</th></tr></thead>
                <tbody>
                  {mandatoryEvaluations.map((evaluation) => (
                    <tr key={evaluation.requirementId}>
                      <td>{built.requirements.find((requirement) => requirement.id === evaluation.requirementId)?.metricId ?? evaluation.metricId}<span className={styles.subtle}>{evaluation.sourceId ?? "No source"}{evaluation.observationDate ? ` · ${evaluation.observationDate}` : ""}</span></td>
                      <td>{formatValue(evaluation.actualValue, evaluation.unit)}</td>
                      <td>{targetLabel(evaluation)}</td>
                      <td className={evaluation.status === "PASS" ? styles.good : evaluation.status === "UNKNOWN" ? styles.unknown : styles.bad}>{evaluation.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === "score" ? (
              <div>
                {selectedResult.score.categories.map((category) => (
                  <details className={styles.category} key={category.categoryId} open>
                    <summary><span>{category.categoryLabel}</span><span>{formatNumber(category.score)}</span><span>{(category.weight * 100).toFixed(0)}%</span></summary>
                    <div className={styles.categoryBody}>
                      <table className={styles.detailTable}>
                        <thead><tr><th>Factor</th><th>Raw</th><th>Normalized</th><th>Weight</th></tr></thead>
                        <tbody>{category.factors.map((factor) => (
                          <tr key={factor.factorId}><td>{factor.factorLabel}</td><td>{formatValue(factor.rawValue)}</td><td>{formatNumber(factor.normalizedScore)}</td><td>{(factor.weight * 100).toFixed(0)}%</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            ) : null}

            {tab === "explain" ? (
              <div>
                {selectedResult.score.categories.flatMap((category) => category.factors.map((factor) => ({ category, factor }))).map(({ category, factor }) => (
                  <details className={styles.category} key={factor.factorId}>
                    <summary><span>{factor.factorLabel}</span><span>{formatNumber(factor.normalizedScore)}</span><span>{factor.normalizationMethod}</span></summary>
                    <div className={styles.categoryBody}>
                      <dl className={styles.metaGrid}>
                        <dt>Category</dt><dd>{category.categoryLabel}</dd>
                        <dt>Metric</dt><dd>{factor.metricId}</dd>
                        <dt>Raw value</dt><dd>{formatValue(factor.rawValue)}</dd>
                        <dt>Normalization</dt><dd>{factor.normalizationMethod}</dd>
                        <dt>Normalized score</dt><dd>{formatNumber(factor.normalizedScore)}</dd>
                        <dt>Factor weight</dt><dd>{(factor.weight * 100).toFixed(1)}%</dd>
                        <dt>Contribution</dt><dd>{formatNumber(factor.weightedContribution, 2)}</dd>
                        <dt>Source</dt><dd>{factor.lineage.sourceId ?? "Unavailable"}</dd>
                        <dt>Dataset</dt><dd>{factor.lineage.sourceDataset ?? "Unavailable"}</dd>
                        <dt>Observation date</dt><dd>{factor.lineage.observationDate ?? "Unavailable"}</dd>
                        <dt>Retrieved</dt><dd>{factor.lineage.retrievedAt ?? "Unavailable"}</dd>
                      </dl>
                    </div>
                  </details>
                ))}
              </div>
            ) : null}

            {tab === "sensitivity" ? (
              <div className={styles.sensitivityList}>
                {selectedSensitivity.length === 0 ? <p>No valid weight sensitivity variants are available for this scenario.</p> : selectedSensitivity.map(({ variant, delta }) => (
                  <div className={styles.sensitivityRow} key={variant.variantId}>
                    <div><strong>{variant.label}</strong><span className={styles.subtle}>Engine-calculated scenario perturbation</span></div>
                    <span>Score {formatNumber(delta?.variantScore ?? null)}</span>
                    <span>Rank {delta?.variantRank ?? "—"}{delta?.rankDelta ? ` (${delta.rankDelta > 0 ? "+" : ""}${delta.rankDelta})` : ""}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {tab === "override" ? (
              <div className={styles.overrideForm}>
                <div className={styles.notice}>{bundle.canPersistOverrides ? "Override persistence is available." : "Authoritative override persistence is not configured. You can preview the effective value, but this action is intentionally not presented as saved."}</div>
                <div className={styles.overrideGrid}>
                  <label>Target<select className={styles.control} value={overrideTarget} onChange={(event) => { setOverrideTarget(event.target.value as typeof overrideTarget); setOverrideValue(event.target.value === "qualification" ? "QUALIFIED_WITH_CONDITION" : ""); }}><option value="qualification">Qualification</option><option value="overall_score">Overall score</option><option value="rank">Rank</option></select></label>
                  <label>Override value{overrideTarget === "qualification" ? (
                    <select className={styles.control} value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)}><option value="QUALIFIED_WITH_CONDITION">Qualified with condition</option><option value="QUALIFIED">Qualified</option><option value="MARGINAL">Marginal</option><option value="DISQUALIFIED">Disqualified</option></select>
                  ) : <input className={styles.control} value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)} inputMode="decimal" placeholder={overrideTarget === "rank" ? "Rank" : "0–100"} />}</label>
                </div>
                <label>Rationale<textarea className={styles.control} value={overrideRationale} onChange={(event) => setOverrideRationale(event.target.value)} placeholder="Required: explain why professional judgment differs from the calculated result." /></label>
                <button type="button" className={styles.button} onClick={previewOverride} disabled={overrideRationale.trim().length < 8}>Preview effective result</button>
                {overridePreview ? <div className={styles.preview}><strong>Working override preview</strong><br />Calculated: {String(overridePreview.calculatedValue ?? "—")} → Effective: {String(overridePreview.effectiveValue ?? "—")}<br />Rationale: {overridePreview.rationale}<br /><strong>Not persisted.</strong> The calculated value remains intact.</div> : null}
              </div>
            ) : null}

            {tab === "history" ? (
              <div className={styles.historyList}>
                <div className={styles.historyRow}><div><strong>Current calculation</strong><span className={styles.subtle}>Requirements v{run.requirementsVersion} · scenario {built.scenario.name}</span></div><span>{new Date(run.asOf).toLocaleString()}</span><span>Engine {run.engineVersion}</span></div>
                {bundle.historicalSnapshots.map((snapshot) => {
                  const historical = snapshot.run.results.find((result) => result.candidateId === selectedResult.candidateId);
                  return <div className={styles.historyRow} key={snapshot.snapshotId}><div><strong>{snapshot.reason}</strong><span className={styles.subtle}>Requirements v{snapshot.run.requirementsVersion} · scenario {snapshot.run.scenarioId}</span></div><span>Score {formatNumber(historical?.score.calculatedScore ?? null)} · rank {historical?.rank ?? "—"}</span><span>{new Date(snapshot.createdAt).toLocaleDateString()}</span></div>;
                })}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
