import Link from "next/link";
import { AnalysisWorkspace } from "@/components/workspace/analysis-workspace";
import { resolveAnalysisWorkspaceSource } from "@/domains/decision-analytics/source";
import styles from "@/components/workspace/analysis-workspace.module.css";

interface AnalysisPageProps {
  searchParams: Promise<{
    projectId?: string;
    sample?: string;
  }>;
}

export default async function AnalysisPage({ searchParams }: AnalysisPageProps) {
  const params = await searchParams;
  const source = resolveAnalysisWorkspaceSource(params);

  if (source.status === "UNAVAILABLE") {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="eyebrow">Decision analytics</div>
            <h1>Analysis</h1>
            <p className="lede">Qualification, scoring, comparison and decision context.</p>
          </div>
        </div>
        <section className={styles.empty}>
          <h2>Analysis inputs are not configured</h2>
          <p>{source.message}</p>
          <div className={styles.emptyActions}>
            <Link className={`${styles.emptyLink} ${styles.emptyLinkPrimary}`} href="/projects">Select project</Link>
            <Link className={styles.emptyLink} href="/analysis?sample=manufacturing">Open labeled sample analysis</Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="eyebrow">Decision analytics</div>
          <h1>{source.bundle.projectName}</h1>
          <p className="lede">Qualification and weighted attractiveness are calculated independently.</p>
        </div>
      </div>
      <AnalysisWorkspace bundle={source.bundle} />
    </>
  );
}
