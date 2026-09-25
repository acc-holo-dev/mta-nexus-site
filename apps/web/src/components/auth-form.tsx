"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type AuthMode = "login" | "register";

function responseError(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const data = value as { error?: unknown; details?: Record<string, { _errors?: unknown }> };
  const fieldErrors = ["email", "username", "password", "displayName"].flatMap((field) => {
    const errors = data.details?.[field]?._errors;
    return Array.isArray(errors) ? errors.filter((error): error is string => typeof error === "string") : [];
  });
  if (fieldErrors.length) return fieldErrors.join(" ");
  return typeof data.error === "string" ? data.error : fallback;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const registering = mode === "register";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const username = String(form.get("username") ?? "").trim();
    const displayName = String(form.get("displayName") ?? "").trim();
    const body = registering
      ? { email, username, password, ...(displayName ? { displayName } : {}) }
      : { email, password };
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(responseError(data, "The request could not be completed. Please try again."));
        setLoading(false);
        return;
      }
      if (data?.success !== true) throw new Error("Invalid authentication response");
      // Replace the document so a previous account's router cache is not reused.
      window.location.replace("/workspace");
    } catch {
      setError(registering
        ? "We could not confirm registration. Try signing in before registering again."
        : "We could not confirm sign in. Check your connection and try again.");
      setLoading(false);
    }
  }

  const input = "w-full rounded-lg border border-base bg-inset px-3 py-2.5 text-sm text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
  const label = "block text-sm font-semibold text-primary";
  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-primary">{registering ? "Create your Nexus account" : "Sign in to MTA Nexus"}</h1>
        <p className="text-sm text-muted">{registering ? "Save free resources and manage your MTA server listings." : "Open your resource library and manage your server listings."}</p>
      </div>
      <form onSubmit={submit} aria-busy={loading} aria-describedby={error ? "auth-error" : undefined} className="nexus-panel space-y-4 p-5">
        {error && <p id="auth-error" role="alert" className="rounded-lg border border-base p-3 text-sm text-primary">{error}</p>}
        <div className="space-y-1.5">
          <label htmlFor="auth-email" className={label}>Email address</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required className={input} />
        </div>
        {registering && <>
          <div className="space-y-1.5">
            <label htmlFor="auth-username" className={label}>Username</label>
            <input id="auth-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_\-]+" aria-describedby="username-hint" className={input} />
            <p id="username-hint" className="text-xs text-muted">3-32 letters, numbers, underscores or hyphens.</p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="auth-display-name" className={label}>Display name (optional)</label>
            <input id="auth-display-name" name="displayName" autoComplete="nickname" minLength={2} maxLength={50} aria-describedby="display-name-hint" className={input} />
            <p id="display-name-hint" className="text-xs text-muted">Leave blank to use your username.</p>
          </div>
        </>}
        <div className="space-y-1.5">
          <label htmlFor="auth-password" className={label}>Password</label>
          <input id="auth-password" name="password" type="password" required minLength={registering ? 8 : 1} maxLength={128} autoComplete={registering ? "new-password" : "current-password"} aria-describedby={registering ? "password-hint" : undefined} className={input} />
          {registering && <p id="password-hint" className="text-xs text-muted">8-128 characters. Use a unique password.</p>}
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] disabled:opacity-50">
          {loading ? (registering ? "Creating account..." : "Signing in...") : (registering ? "Create account" : "Sign In")}
        </button>
      </form>
      <div className="space-y-2 text-sm text-muted">
        {!registering && <p><Link href="/auth/forgot-password" className="font-semibold text-accent underline">Forgot password?</Link></p>}
        <p>{registering ? "Already have an account? " : "New to MTA Nexus? "}<Link href={registering ? "/auth/login" : "/auth/register"} className="font-semibold text-accent underline">{registering ? "Sign In" : "Create an account"}</Link></p>
      </div>
    </div>
  );
}
