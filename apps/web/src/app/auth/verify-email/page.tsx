"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";

type Proof = { challengeId: string; token: string };
type State =
  | { kind: "loading" }
  | { kind: "ready"; proof: Proof }
  | { kind: "invalid" }
  | { kind: "submitting"; proof: Proof }
  | { kind: "success"; email: string }
  | { kind: "error"; proof?: Proof; message: string };

function readProof(): Proof | null {
  const url = new URL(window.location.href);
  const challengeId = url.searchParams.get("challenge") ?? "";
  const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const token = fragment.get("token") ?? "";
  // Strip the secret before any user action. URL fragments are not sent to the
  // server, but keeping them in browser history would unnecessarily retain it.
  window.history.replaceState(null, "", url.pathname + url.search);
  if (!/^ach_[A-Za-z0-9_-]{1,96}$/.test(challengeId) || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null;
  }
  return { challengeId, token };
}

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const proof = readProof();
    setState(proof ? { kind: "ready", proof } : { kind: "invalid" });
  }, []);

  async function confirm(proof: Proof) {
    setState({ kind: "submitting", proof });
    try {
      const response = await fetch("/api/auth/email-verification", {
        method: "PATCH",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true || typeof data.email !== "string") {
        throw new Error(data?.error || "This email confirmation is invalid or expired.");
      }
      setState({ kind: "success", email: data.email });
    } catch (error: unknown) {
      setState({
        kind: "error",
        proof,
        message: error instanceof Error ? error.message : "Could not confirm this email. Please try again.",
      });
    }
  }

  return (
    <div className="max-w-lg mx-auto py-16">
      <section aria-labelledby="verify-email-heading" className="nexus-panel p-6 space-y-5">
        <div className="flex items-center gap-3">
          <MailCheck className="w-5 h-5 text-accent" aria-hidden="true" />
          <h1 id="verify-email-heading" className="font-display text-primary">Confirm recovery email</h1>
        </div>
        {state.kind === "loading" && <p role="status" className="text-sm text-muted">Checking this confirmation link...</p>}
        {state.kind === "invalid" && (
          <>
            <p role="alert" className="text-sm text-muted">This confirmation link is incomplete or invalid. Request a new one from Settings.</p>
            <Link href="/settings" className="inline-block text-sm font-semibold text-accent">Back to Settings</Link>
          </>
        )}
        {(state.kind === "ready" || state.kind === "submitting") && (
          <>
            <p className="text-sm text-muted">
              Confirming verifies the email currently stored on your account for future recovery. It does not change your password or sign you out.
            </p>
            <button
              type="button"
              disabled={state.kind === "submitting"}
              onClick={() => void confirm(state.proof)}
              className="px-4 py-2 rounded-md bg-accent text-white text-sm font-semibold disabled:opacity-50"
            >
              {state.kind === "submitting" ? "Confirming..." : "Confirm email"}
            </button>
          </>
        )}
        {state.kind === "error" && (
          <>
            <p role="alert" className="text-sm text-muted">{state.message}</p>
            {state.proof && (
              <button type="button" onClick={() => void confirm(state.proof!)}
                className="px-4 py-2 rounded-md bg-accent text-white text-sm font-semibold">Try again</button>
            )}
            <Link href="/settings" className="block text-sm font-semibold text-accent">Back to Settings</Link>
          </>
        )}
        {state.kind === "success" && (
          <>
            <p role="status" className="text-sm text-primary">Recovery email verified: {state.email}</p>
            <p className="text-xs text-muted">The confirmation cannot be used again.</p>
            <Link href="/settings" className="inline-block text-sm font-semibold text-accent">Back to Settings</Link>
          </>
        )}
      </section>
    </div>
  );
}
