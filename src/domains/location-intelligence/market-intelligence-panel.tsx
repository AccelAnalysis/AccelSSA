import Link from "next/link";
import type { IntelligenceMetricView, IntelligenceTab, MarketIntelligenceProfile } from "./types";
import { INTELLIGENCE_TABS } from "./types";
import styles from "./market-intelligence-panel.module.css";

const labels: Record<IntelligenceTab, string> = {
  market: "Market",
  workforce: "Workforce",
  occupations: "Occupations",
  wages: "Wages",
  education: "Education / training",
  employers: "Employer competition",
  transportation: "Transportation",
  utilities: "Utilities",
  "business-climate": "Business climate",
  "quality-of-life": "Quality of life",
};

function stateClass(metric: IntelligenceMetricView) {
  if (metric.state === "KNOWN" || metric.state === "ESTIMATED") return styles.known;
  if (metric.state === "STALE") return styles.stale;
  return styles.unknown;
}

export function MarketIntelligencePanel({
  profile,
  activeTab,
  baseHref,
}: {
  profile: MarketIntelligenceProfile;
  activeTab: IntelligenceTab;
  baseHref: string;
}) {
  const rows = profile.metrics.filter((metric) => metric.tab === activeTab);
  const candidate = profile.candidate;

  return (
    <section className={styles.workspace}>
      <div className={styles.context}>
        <div>
          <h2>{candidate.name}</h2>
          <p>{candidate.geographyLabel ?? candidate.geographyId ?? "Candidate geography unresolved"}{candidate.geographyType ? ` · ${candidate.geographyType}` : ""}</p>
        </div>
        <p>As of {profile.asOf.slice(0, 10)}</p>
      </div>

      <div className={styles.summary} aria-label="Intelligence coverage summary">
        <div className={styles.metric}><strong>{profile.knownCount}</strong><span>Current / estimated metrics</span></div>
        <div className={styles.metric}><strong>{profile.staleCount}</strong><span>Stale metrics</span></div>
        <div className={styles.metric}><strong>{profile.unknownCount}</strong><span>Unknown / unavailable</span></div>
        <div className={styles.metric}><strong>{profile.observationCount}</strong><span>Loaded observations</span></div>
      </div>

      <div className={styles.statusBar} aria-label="Data provider status">
        {profile.providerStatus.map((provider) => (
          <span className={`${styles.status} ${provider.state === "READY" ? styles.ready : provider.state === "UNAVAILABLE" ? styles.unavailable : styles.notConfigured}`} key={provider.id} title={provider.detail}>
            <span className={styles.dot} aria-hidden="true" />
            <strong>{provider.label}</strong>: {provider.state === "READY" ? "Ready" : provider.state === "UNAVAILABLE" ? "Unavailable" : "Not configured"}
          </span>
        ))}
        {profile.rejectedObservationCount > 0 ? <span className={`${styles.status} ${styles.unavailable}`}>{profile.rejectedObservationCount} imported observation{profile.rejectedObservationCount === 1 ? "" : "s"} rejected</span> : null}
      </div>

      <nav className={styles.tabs} aria-label="Market intelligence views">
        {INTELLIGENCE_TABS.map((tab) => (
          <Link className={`${styles.tab} ${activeTab === tab ? styles.active : ""}`} href={`${baseHref}?tab=${tab}`} key={tab}>
            {labels[tab]}
          </Link>
        ))}
      </nav>

      <div className={styles.tableWrap}>
        {rows.length > 0 ? (
          <table className={styles.table}>
            <thead><tr><th>Metric</th><th>Value</th><th>Geography</th><th>Source</th><th>Vintage</th><th>Confidence</th><th>Freshness</th></tr></thead>
            <tbody>
              {rows.map((metric) => (
                <tr key={metric.key}>
                  <td>{metric.label}</td>
                  <td>{metric.value}</td>
                  <td>{metric.geography}</td>
                  <td>{metric.source}</td>
                  <td>{metric.vintage}</td>
                  <td>{metric.confidence}</td>
                  <td><span className={`${styles.state} ${stateClass(metric)}`}>{metric.freshness}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.empty}>No observations are available for this view. Status: Unknown.</div>
        )}
      </div>
    </section>
  );
}
