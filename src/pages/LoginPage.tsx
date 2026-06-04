import { FormEvent, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { ThemeToggle } from "@/components/ThemeToggle";

export function LoginPage() {
  const { signIn, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const displayError = error || authError;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    clearAuthError();
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-theme-toggle">
        <ThemeToggle showLabel={false} />
      </div>
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Sign in to your Solva workspace. New accounts are created by an administrator.</p>
        {displayError && <div className="auth-error">{displayError}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Please wait…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
