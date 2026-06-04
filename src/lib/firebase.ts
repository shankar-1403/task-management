import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

function env(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

const requiredKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_DATABASE_URL",
] as const;

const missing = requiredKeys.filter((key) => !env(key));
if (missing.length > 0) {
  throw new Error(
    `Missing Firebase env: ${missing.join(", ")}. Copy .env.example to .env and fill in values from Firebase Console → Project settings.`,
  );
}

export const firebaseConfig: FirebaseOptions = {
  apiKey: env("VITE_FIREBASE_API_KEY"),
  authDomain: env("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: env("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: env("VITE_FIREBASE_STORAGE_BUCKET") || undefined,
  messagingSenderId: env("VITE_FIREBASE_MESSAGING_SENDER_ID") || undefined,
  appId: env("VITE_FIREBASE_APP_ID"),
  databaseURL: env("VITE_FIREBASE_DATABASE_URL"),
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
