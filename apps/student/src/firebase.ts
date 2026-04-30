import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const FALLBACK_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAJop5e8f1gBb19MsAelhCpAVf_2bR_1jE",
  authDomain: "teacher-ai-cookbook.firebaseapp.com",
  projectId: "teacher-ai-cookbook",
  appId: "1:664926316361:web:c0132ac1539b9aca90dc98",
};

/**
 * Checks whether the current hostname is local-only.
 * @param {string} hostname - Browser hostname to validate.
 */
function isLocalHostName(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/**
 * Picks Firebase web config, falling back to production values when
 * deploys accidentally use local demo env vars.
 * @param {boolean} isLocalHost - Whether the app runs on localhost.
 */
function resolveFirebaseConfig(isLocalHost: boolean) {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  const hasDemoKey =
    typeof config.apiKey === "string" && config.apiKey.startsWith("demo-");
  const isMissingRequired =
    !config.apiKey || !config.authDomain || !config.projectId || !config.appId;

  if (!isLocalHost && (hasDemoKey || isMissingRequired)) {
    return FALLBACK_FIREBASE_CONFIG;
  }

  return config;
}

const isLocalHost =
  typeof window !== "undefined" && isLocalHostName(window.location.hostname);
const firebaseConfig = resolveFirebaseConfig(isLocalHost);

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

if (import.meta.env.VITE_USE_EMULATOR === "1" && isLocalHost) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
}

export async function ensureSignedIn(): Promise<void> {
  if (auth.currentUser) return;
  console.log("signing in anonymously");
  await signInAnonymously(auth);
}
