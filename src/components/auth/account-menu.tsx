import Link from "next/link";
import styles from "./account-menu.module.css";

export interface AccountMenuProps {
  email: string;
  tenantName: string;
  role: string;
}

export function AccountMenu({ email, tenantName, role }: AccountMenuProps) {
  const initial = email.trim().charAt(0).toUpperCase() || "U";
  return (
    <details className={styles.menu}>
      <summary className={styles.summary} aria-label="User account menu">
        <span className={styles.avatar} aria-hidden="true">{initial}</span>
        <span className={styles.label}>{email}</span>
      </summary>
      <div className={styles.popover}>
        <strong>{tenantName}</strong>
        <span>{role.replaceAll("_", " ")}</span>
        <Link href="/account">Account</Link>
        <form action="/api/v1/auth/sign-out" method="post"><button type="submit">Sign out</button></form>
      </div>
    </details>
  );
}
