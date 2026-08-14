"use client";

import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseClientAuth } from "@/domains/identity-security/firebase-client";

export function InviteUserForm({ tenantId, roles }: { tenantId: string; roles: readonly string[] }) {
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const role = String(form.get("role") ?? "");
    try {
      const response = await fetch("/api/v1/admin/users", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId, email, role }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message ?? "Unable to create invitation.");
      try {
        const auth = await getFirebaseClientAuth();
        await sendPasswordResetEmail(auth, email);
        setMessage(`Invitation created for ${email}; Firebase sent the password setup/reset email.`);
      } catch {
        setMessage(`Invitation created for ${email}, but the browser could not send the Firebase password email. Use Firebase Authentication to send a reset before the user signs in.`);
      }
      event.currentTarget.reset();
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <label>Email<input name="email" type="email" required /></label>
      <label>Role<select name="role" defaultValue="ANALYST">{roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label>
      <button className="button" type="submit" disabled={busy}>{busy ? "Inviting…" : "Invite / update member"}</button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
