import admin from "firebase-admin";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let initialized = false;

export function initFirebaseAdmin() {
  if (initialized) return admin;

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    resolve(__dirname, "../serviceAccountKey.json");

  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Firebase service account not found at ${serviceAccountPath}. ` +
        "Download it from Firebase Console → Project settings → Service accounts.",
    );
  }

  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });

  initialized = true;
  return admin;
}

export function getDb() {
  initFirebaseAdmin();
  return admin.database();
}

export async function verifyIdToken(idToken) {
  initFirebaseAdmin();
  return admin.auth().verifyIdToken(idToken);
}
