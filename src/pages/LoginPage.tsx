import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { ThemeToggle } from "@/components/ThemeToggle";

function getInviteParams(): { signup: boolean; email: string } {
  const params = new URLSearchParams(window.location.search);
  return {
    signup: params.get("signup") === "1",
    email: params.get("email")?.trim() ?? "",
  };
}

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const invite = getInviteParams();
  const [mode, setMode] = useState<"signin" | "signup">(invite.signup ? "signup" : "signin");
  const [email, setEmail] = useState(invite.email);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (invite.signup) setMode("signup");
    if (invite.email) setEmail(invite.email);
  }, [invite.signup, invite.email]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName || email.split("@")[0]);
      }
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
        <h1>{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p>
          {invite.signup && invite.email
            ? "Create an account to accept your project invitation."
            : "Organize work in projects, sections, and tasks — Asana style."}
        </p>
        {error && <div className="auth-error">{error}</div>}
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <>
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Cooper"
                autoComplete="name"
              />
            </>
          )}
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
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
          <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Please wait…" : mode === "signin" ? "Log in" : "Sign up"}
          </button>
        </form>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 12 }}
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
