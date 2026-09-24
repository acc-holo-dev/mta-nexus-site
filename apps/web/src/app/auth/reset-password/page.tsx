"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

type Proof = { challengeId: string; token: string };
type State =
  | { kind: "loading" }
  | { kind: "ready"; proof: Proof }
  | { kind: "submitting"; proof: Proof }
  | { kind: "invalid" }
  | { kind: "error"; proof?: Proof; message: string }
  | { kind: "success" };

function readProof(): Proof | null {
  const url = new URL(window.location.href);
  const challengeId = url.searchParams.get("challenge") ?? "";
  const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const token = fragment.get("token") ?? "";
  window.history.replaceState(null, "", url.pathname + url.search);
  if (!/^ach_[A-Za-z0-9_-]{1,96}$/.test(challengeId) || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return { challengeId, token };
}

export default function ResetPasswordPage() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [passwords, setPasswords] = useState({ next: "", confirm: "" });

  useEffect(() => {
    const proof = readProof();
    setState(proof ? { kind: "ready", proof } : { kind: "invalid" });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "ready" && state.kind !== "error") return;
    if (!state.proof) return;
    if (passwords.next !== passwords.confirm) {
      setState({ kind: "error", proof: state.proof, message: "Passwords do not match." });
      return;
    }
    const proof = state.proof;
    setState({ kind: "submitting", proof });
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...proof, newPassword: passwords.next }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || "Invalid or expired password reset");
      }
      setPasswords({ next: "", confirm: "" });
      setState({ kind: "success" });
    } catch (error: unknown) {
      setState({
        kind: "error",
        proof,
        message: error instanceof Error ? error.message : "Could not reset the password.",
      });
    }
  }

  const proof = state.kind === "ready" || state.kind === "submitting" || state.kind === "error"
    ? state.proof : undefined;

  return (
    <div className="mx-auto max-w-md py-12">
      <section aria-labelledby="reset-heading" className="nexus-panel space-y-5 p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
          <h1 id="reset-heading" className="font-display text-primary">Reset password</h1>
        </div>
        {state.kind === "loading" && <p role="status" className="text-sm text-muted">Checking this reset link...</p>}
        {state.kind === "invalid" && (
          <>
            <p role="alert" className="text-sm text-muted">This reset link is incomplete or invalid.</p>
            <Link href="/auth/forgot-password" className="text-sm font-semibold text-accent underline">Request a new link</Link>
          </>
        )}
        {proof && state.kind !== "success" && (
          <form onSubmit={submit} aria-label="Reset password" className="space-y-4">
            <p className="text-sm text-muted">Choose a new password. A successful reset signs out every existing session.</p>
            {state.kind === "error" && <p role="alert" className="rounded-lg border border-base p-3 text-sm text-primary">{state.message}</p>}
            <div className="space-y-1.5">
              <label htmlFor="reset-new-password" className="block text-sm font-semibold text-primary">New password</label>
              <input id="reset-new-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
                disabled={state.kind === "submitting"} value={passwords.next}
                onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
                className="w-full rounded-lg border border-base bg-inset px-3 py-2.5 text-sm text-primary" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reset-confirm-password" className="block text-sm font-semibold text-primary">Confirm new password</label>
              <input id="reset-confirm-password" type="password" autoComplete="new-password" required minLength={8} maxLength={128}
                disabled={state.kind === "submitting"} value={passwords.confirm}
                onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })}
                className="w-full rounded-lg border border-base bg-inset px-3 py-2.5 text-sm text-primary" />
            </div>
            <button type="submit" disabled={state.kind === "submitting"}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              {state.kind === "submitting" ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
        {state.kind === "success" && (
          <>
            <p role="status" className="text-sm text-primary">
              Password reset. All existing sessions were signed out. Sign in with your new password.
            </p>
            <Link href="/auth/login" className="text-sm font-semibold text-accent underline">Sign in</Link>
          </>
        )}
      </section>
    </div>
  );
}
