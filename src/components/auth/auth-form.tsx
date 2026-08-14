"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { FirebaseClientConfigurationError, getFirebaseClientAuth } from "@/domains/identity-security/firebase-client";
import styles from "./auth-form.module.css";

type Mode = "sign-in" | "register" | "reset";

function safeNext(): string {
  if (typeof window === "undefined") return "/projects";
  const candidate = new URLSearchParams(window.location.search).get("next") ?? "/projects";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/projects";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(undefined);
    try {
      const auth = await getFirebaseClientAuth();
      if (mode === "reset") {
        await sendPasswordResetEmail(auth, email);
        setMessage("If the account exists, Firebase has sent password-reset instructions.");
        return;
      }
      if (mode === "register") {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(result.user);
        setMessage("Account created. Verify your email, then sign in. Workspace access begins after an administrator grants tenant membership.");
        await signOut(auth);
        return;
      }
      const result = await signInWithEmailAndPassword(auth, email, password);
      if (!result.user.emailVerified) {
        await sendEmailVerification(result.user);
        setMessage("Your email is not verified. A verification email has been sent; verify it and sign in again.");
        await signOut(auth);
        return;
      }
      const idToken = await result.user.getIdToken(true);
      const response = await fetch("/api/v1/auth/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message ?? "Unable to create the AccelSSA session.");
      await signOut(auth);
      window.location.assign(safeNext());
    } catch (error) {
      if (error instanceof FirebaseClientConfigurationError) {
        window.location.assign("/auth/configuration-required");
        return;
      }
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "sign-in" ? "Sign in" : mode === "register" ? "Create account" : "Reset password";
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="auth-title">
        <div className={styles.brand}>AccelSSA</div>
        <h1 id="auth-title">{title}</h1>
        <p className={styles.intro}>
          {mode === "sign-in"
            ? "Use your verified work account to enter the site-selection workspace."
            : mode === "register"
              ? "Create your identity. An organization administrator must still grant workspace access."
              : "Enter your account email to request a reset link."}
        </p>
        <form onSubmit={submit} className={styles.form}>
          <label>Email<input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {mode !== "reset" && (
            <label>Password<input required minLength={8} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          )}
          <button disabled={busy} type="submit">{busy ? "Working…" : title}</button>
        </form>
        {message && <p className={styles.message} role="status">{message}</p>}
        <nav className={styles.links} aria-label="Authentication options">
          {mode !== "sign-in" && <Link href="/auth/sign-in">Sign in</Link>}
          {mode !== "register" && <Link href="/auth/register">Create account</Link>}
          {mode !== "reset" && <Link href="/auth/reset-password">Forgot password?</Link>}
        </nav>
      </section>
    </main>
  );
}
