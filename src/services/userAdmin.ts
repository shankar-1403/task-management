import { get, ref } from "firebase/database";
import { createAuthUserAccount } from "@/lib/firebaseAdminAuth";
import { db } from "@/lib/firebase";
import {
  adminDeleteUserProfile,
  adminUpdateUserProfile,
  createUserProfileRecord,
  emailKey,
  listAllUsers,
  rebuildDepartmentProjectIndexes,
  rebuildDepartmentUserIndexes,
  type AdminUpdateUserInput,
} from "@/services/database";
import type { UserDepartment, UserProfile, UserRole } from "@/types";

export { listAllUsers, rebuildDepartmentProjectIndexes, rebuildDepartmentUserIndexes };
export type { AdminUpdateUserInput };

export interface CreateUserInput {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  department: UserDepartment | null;
  allDepartments: boolean;
}

export interface UpdateUserInput {
  uid: string;
  displayName: string;
  role: UserRole;
  department: UserDepartment | null;
  allDepartments: boolean;
}

export async function adminCreateUser(input: CreateUserInput): Promise<UserProfile> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email is required.");
  if (input.password.length < 6) throw new Error("Password must be at least 6 characters.");

  if (input.role === "member" && !input.department) {
    throw new Error("Members must be assigned a department.");
  }
  if (input.role === "management" && !input.allDepartments && !input.department) {
    throw new Error("Choose a department or enable access to both departments.");
  }

  const uid = await createAuthUserAccount(email, input.password, input.displayName.trim());
  const profile: UserProfile = {
    uid,
    email,
    displayName: input.displayName.trim() || email.split("@")[0],
    role: input.role,
    department: input.role === "admin" ? null : input.allDepartments ? null : input.department,
    allDepartments: input.role === "admin" || input.allDepartments,
  };
  await createUserProfileRecord(profile);
  return profile;
}

export async function adminUpdateUser(input: UpdateUserInput): Promise<UserProfile> {
  return adminUpdateUserProfile(input);
}

export async function adminDeleteUser(
  target: UserProfile,
  currentAdminUid: string,
): Promise<void> {
  await adminDeleteUserProfile(target, currentAdminUid);
}

export async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const snap = await get(ref(db, `usersByEmail/${emailKey(email.trim().toLowerCase())}`));
  return snap.exists();
}
