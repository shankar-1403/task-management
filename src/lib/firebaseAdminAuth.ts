import { initializeApp, type FirebaseOptions } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
  updateProfile,
} from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase";

const adminProvisionerApp = initializeApp(firebaseConfig as FirebaseOptions, "admin-provisioner");

const provisionerAuth = getAuth(adminProvisionerApp);

/** Creates a Firebase Auth user without signing out the current admin session. */
export async function createAuthUserAccount(
  email: string,
  password: string,
  displayName: string,
): Promise<string> {
  const cred = await createUserWithEmailAndPassword(provisionerAuth, email, password);
  await updateProfile(cred.user, { displayName });
  const uid = cred.user.uid;
  await signOut(provisionerAuth);
  return uid;
}
