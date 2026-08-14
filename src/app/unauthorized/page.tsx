import Link from "next/link";
import styles from "@/components/auth/auth-form.module.css";

export default function UnauthorizedPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>AccelSSA</div>
        <h1>Access not authorized</h1>
        <p className={styles.intro}>Your identity is valid, but it does not have the tenant, project, role, or visibility permission required for this workspace.</p>
        <form action="/api/v1/auth/sign-out" method="post"><button type="submit">Sign out</button></form>
        <nav className={styles.links}><Link href="/auth/sign-in">Use another account</Link></nav>
      </section>
    </main>
  );
}
