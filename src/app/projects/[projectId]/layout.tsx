import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getProjectOverview, ProjectWorkspaceAuthorizationError } from "@/domains/projects-workspace/runtime";
import styles from "@/components/projects/projects.module.css";

export default async function SelectedProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  let overview;
  try {
    overview = await getProjectOverview((await headers()).get("cookie"), projectId);
  } catch (error) {
    if (error instanceof ProjectWorkspaceAuthorizationError) redirect("/unauthorized");
    throw error;
  }
  if (!overview) notFound();
  return (
    <>
      <header className={styles.projectHeader}>
        <div className={styles.projectTitle}>
          <Link className="eyebrow" href="/projects">Projects</Link>
          <h1>{overview.project.name}</h1>
          <p>{overview.clientName} · {overview.stageLabel}</p>
        </div>
      </header>
      <nav className={styles.tabs} aria-label="Project navigation">
        <Link className={styles.tab} href={`/projects/${projectId}`}>Overview</Link>
      </nav>
      {children}
    </>
  );
}
