import { FirebaseError } from "firebase/app";

export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/configuration-not-found":
        return (
          "Firebase Authentication is not set up for this project. Open the Firebase Console → " +
          "Authentication → click Get started → Sign-in method → enable Email/Password → Save. " +
          "Then restart the dev server and try again."
        );
      case "auth/operation-not-allowed":
        return "Email/password sign-in is disabled. Enable it under Authentication → Sign-in method.";
      case "auth/email-already-in-use":
        return "An account with this email already exists. Try logging in instead.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password must be at least 6 characters.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a few minutes and try again.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      default:
        return error.message;
    }
  }
  if (error instanceof Error) return error.message;
  return "Authentication failed";
}
