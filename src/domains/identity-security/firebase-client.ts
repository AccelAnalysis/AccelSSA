"use client";

import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, inMemoryPersistence, setPersistence, type Auth } from "firebase/auth";

export const FIREBASE_CLIENT_ENV = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const;

export class FirebaseClientConfigurationError extends Error {
  readonly missing = FIREBASE_CLIENT_ENV;

  constructor(cause?: unknown) {
    super("Firebase Authentication client configuration is not available.", { cause });
    this.name = "FirebaseClientConfigurationError";
  }
}

function explicitOptions(): FirebaseOptions | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}

function initializeClientApp(): FirebaseApp {
  if (getApps().length) return getApp();
  const options = explicitOptions();
  if (options) return initializeApp(options);

  // Firebase App Hosting provides FIREBASE_WEBAPP_CONFIG at build time. Recent
  // Firebase JS SDK releases embed that default configuration during install,
  // allowing initializeApp() with no explicit browser credentials.
  try {
    return (initializeApp as (options?: FirebaseOptions) => FirebaseApp)();
  } catch (error) {
    throw new FirebaseClientConfigurationError(error);
  }
}

let authPromise: Promise<Auth> | undefined;

export function getFirebaseClientAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const auth = getAuth(initializeClientApp());
    // Browser storage is deliberately not an authorization boundary. The
    // authoritative application session is an HttpOnly Firebase session cookie.
    await setPersistence(auth, inMemoryPersistence);
    return auth;
  })();
  return authPromise;
}
