import { applicationDefault, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

export const FIREBASE_SERVER_ENV = ["ACCELSSA_FIREBASE_PROJECT_ID"] as const;

export class FirebaseServerConfigurationError extends Error {
  constructor(cause?: unknown) {
    super(
      "Firebase Admin credentials are unavailable. App Hosting should use Application Default Credentials; local development may set GOOGLE_APPLICATION_CREDENTIALS.",
      { cause },
    );
    this.name = "FirebaseServerConfigurationError";
  }
}

function adminApp(): App {
  if (getApps().length) return getApp();
  try {
    const projectId = process.env.ACCELSSA_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
    return initializeApp({
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  } catch (error) {
    throw new FirebaseServerConfigurationError(error);
  }
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(adminApp());
}
