import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { createClientProjectAction } from "@/app/projects/actions";
import styles from "./projects-workspace.module.css";

const stateMessages: Record<string, string> = {
  infrastructure: "Project persistence or authenticated project identity is not configured. Nothing was saved.",
  "save-failed": "The client/project could not be saved. Nothing was reported as successful.",
};

export function ProjectCreateForm({ state }: { state?: string }) {
  return (
    <>
      <div className="page-header-with-action">
        <PageHeader eyebrow="New engagement" title="Create Client & Project" description="Create the client record and authoritative site-selection project in one transaction." />
        <Link className="button button-secondary" href="/projects">Cancel</Link>
      </div>
      {state && stateMessages[state] ? <p className={styles.message}>{stateMessages[state]}</p> : null}
      <form action={createClientProjectAction}>
        <section className={styles.formSection}>
          <h2>Client</h2>
          <div className={styles.formGrid}>
            <label className={styles.field}><span className={styles.label}>Legal name *</span><input className={styles.input} name="clientLegalName" required /></label>
            <label className={styles.field}><span className={styles.label}>Operating name</span><input className={styles.input} name="clientOperatingName" /></label>
            <label className={styles.field}><span className={styles.label}>Industry</span><input className={styles.input} name="industry" /></label>
          </div>
        </section>
        <section className={styles.formSection}>
          <h2>Project</h2>
          <div className={styles.formGrid}>
            <label className={styles.fieldFull}><span className={styles.label}>Project name *</span><input className={styles.input} name="projectName" required placeholder="Southeast Manufacturing Expansion" /></label>
            <label className={styles.field}><span className={styles.label}>Project type</span><select className={styles.select} name="projectType" defaultValue="expansion"><option value="expansion">Expansion</option><option value="relocation">Relocation</option><option value="new_facility">New facility</option><option value="consolidation">Consolidation</option><option value="portfolio">Portfolio review</option></select></label>
            <label className={styles.field}><span className={styles.label}>Facility type</span><select className={styles.select} name="facilityType" defaultValue="manufacturing"><option value="manufacturing">Manufacturing</option><option value="distribution">Distribution / Logistics</option><option value="headquarters">Headquarters</option><option value="office">Office</option><option value="data_center">Data center</option><option value="r_and_d">R&amp;D</option><option value="retail">Retail</option><option value="other">Other</option></select></label>
            <label className={styles.fieldFull}><span className={styles.label}>Target geographies</span><input className={styles.input} name="targetGeographies" placeholder="VA, NC, SC, GA" /><span className={styles.subtle}>Comma-separated states, regions or study areas.</span></label>
            <label className={styles.field}><span className={styles.label}>Target opening</span><input className={styles.input} type="date" name="targetOpeningDate" /></label>
            <label className={styles.field}><span className={styles.label}>Capital investment</span><input className={styles.input} type="number" min="0" step="1000" name="capitalInvestment" /></label>
            <label className={styles.field}><span className={styles.label}>Planned employment</span><input className={styles.input} type="number" min="0" step="1" name="plannedEmployment" /></label>
            <label className={styles.field}><span className={styles.label}>Average wage</span><input className={styles.input} type="number" min="0" step="100" name="averageWage" /></label>
          </div>
        </section>
        <div className="button-row"><button className={styles.primaryButton} type="submit">Create Project</button><span className={styles.meta}>The client and project are committed together. A failed transaction creates neither record.</span></div>
      </form>
    </>
  );
}
