import Link from "next/link";
import styles from "@/components/auth/auth-form.module.css";

const browserFallback = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

export default function AuthenticationConfigurationRequiredPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel}>
        <div className={styles.brand}>AccelSSA</div>
        <h1>Authentication configuration required</h1>
        <p className={styles.intro}>
          The application cannot establish its Firebase identity or authoritative tenant store. No credentials should be committed to the repository.
        </p>
        <p>Firebase App Hosting should supply browser configuration automatically. For local or manual deployments, provide:</p>
        <ul className={styles.configList}>{browserFallback.map((name) => <li key={name}>{name}</li>)}</ul>
        <p>Server-side identity also requires <code>ACCELSSA_FIREBASE_PROJECT_ID</code>, <code>DATABASE_URL</code>, and Application Default Credentials. Local server development may use <code>GOOGLE_APPLICATION_CREDENTIALS</code>.</p>
        <nav className={styles.links}><Link href="/auth/sign-in">Return to sign in</Link></nav>
      </section>
    </main>
  );
}
