import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { loadUserProfile, upsertUserProfile } from "@/services/database";
import {
  adminCreateUser,
  adminDeleteUser,
  adminUpdateUser,
  type CreateUserInput,
  type UpdateUserInput,
} from "@/services/userAdmin";
import type { UserProfile } from "@/types";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  createUser: (input: CreateUserInput) => Promise<UserProfile>;
  updateUser: (input: UpdateUserInput) => Promise<UserProfile>;
  deleteUser: (target: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileSyncErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes("permission") || err.message.includes("PERMISSION")) {
      return `${err.message} Deploy database.rules.json, then try again.`;
    }
    return err.message;
  }
  return "Could not load your account profile. Contact your administrator.";
}

async function syncProfile(firebaseUser: User): Promise<UserProfile> {
  const stored = await loadUserProfile(firebaseUser.uid);
  if (!stored) {
    throw new Error(
      "No account profile found. Ask your administrator to create your account in Manage users before signing in.",
    );
  }

  const profile: UserProfile = {
    ...stored,
    email: (firebaseUser.email ?? stored.email).toLowerCase(),
    displayName:
      firebaseUser.displayName ||
      stored.displayName ||
      firebaseUser.email?.split("@")[0] ||
      "User",
    photoURL: firebaseUser.photoURL ?? stored.photoURL,
  };
  await upsertUserProfile(profile);
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          setAuthError(null);
          setUser(await syncProfile(firebaseUser));
        } catch (err) {
          console.error("Profile sync failed:", err);
          setAuthError(profileSyncErrorMessage(err));
          await signOut(auth);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const createUser = useCallback(async (input: CreateUserInput) => {
    if (user?.role !== "admin") {
      throw new Error("Only administrators can create users.");
    }
    return adminCreateUser(input);
  }, [user?.role]);

  const updateUser = useCallback(
    async (input: UpdateUserInput) => {
      if (user?.role !== "admin") {
        throw new Error("Only administrators can edit users.");
      }
      return adminUpdateUser(input);
    },
    [user?.role],
  );

  const deleteUser = useCallback(
    async (target: UserProfile) => {
      if (user?.role !== "admin") {
        throw new Error("Only administrators can delete users.");
      }
      if (!user) throw new Error("Not signed in.");
      await adminDeleteUser(target, user.uid);
    },
    [user],
  );

  const logout = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      authError,
      clearAuthError,
      signIn,
      createUser,
      updateUser,
      deleteUser,
      logout,
    }),
    [user, loading, authError, clearAuthError, signIn, createUser, updateUser, deleteUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
