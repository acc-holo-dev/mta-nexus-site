"use client";

import Link from "next/link";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";

type IssuedChallenge = Readonly<{
  challengeId: string;
  token: string;
  expiresAt: string;
}>;

export function ServerClaimControlPanel({
  serverId,
  serverName,
}: {
  serverId: string;
  serverName: string;
}) {
  const [challenge, setChallenge] = useState<IssuedChallenge | null>(null);
  const [state, setState] = useState<
    "idle" | "issuing" | "issued" | "verifying" | "verified"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [requiresLogin, setRequiresLogin] = useState(false);

  async function issue() {
    if (state === "issuing" || state === "verifying") return;
    setState("issuing");
    setError(null);
    setRequiresLogin(false);

    try {
      const response = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/claim-challenge`,
        {
          method: "POST",
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        },
      );
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        setRequiresLogin(true);
        setState("idle");
        return;
      }
      if (!response.ok || !data?.challenge) {
        setError(data?.error || "Could not create control challenge.");
        setState("idle");
        return;
      }

      setChallenge({
        challengeId: data.challenge.challengeId,
        token: data.challenge.token,
        expiresAt: data.challenge.expiresAt,
      });
      setState("issued");
    } catch {
      setError("Server control challenge is temporarily unavailable.");
      setState("idle");
    }
  }

  async function verify() {
    if (!challenge || state !== "issued") return;
    setState("verifying");
    setError(null);

    try {
      const response = await fetch(
        `/api/servers/${encodeURIComponent(
          serverId,
        )}/claim-challenge/verify`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            token: challenge.token,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        setRequiresLogin(true);
        setState("issued");
        return;
      }
      if (!response.ok) {
        setError(data?.error || "Control proof was not accepted.");
        setState("issued");
        return;
      }

      setState("verified");
    } catch {
      setError("Control proof verification is temporarily unavailable.");
      setState("issued");
    }
  }

  if (state === "verified") {
    return (
      <section className="nexus-panel border-emerald-500/20 p-5 space-y-2">
        <div className="flex items-center gap-2 text-emerald-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <h2 className="text-sm font-bold">MTA control proof recorded</h2>
        </div>
        <p className="text-xs leading-relaxed text-neutral-400">
          NEXUS observed the one-time token on the official MTA master-list.
          The ownership request is now waiting for moderator review. You may
          remove the token from the server name.
        </p>
        <p className="text-[10px] text-neutral-500">
          Control proof does not assign ownership by itself; moderation remains
          a separate step.
        </p>
      </section>
    );
  }

  return (
    <section
      className="nexus-panel p-5 space-y-4"
      aria-labelledby="server-control-proof-heading"
    >
      <div className="flex items-start gap-3">
        <KeyRound
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-400"
          aria-hidden="true"
        />
        <div>
          <h2
            id="server-control-proof-heading"
            className="text-sm font-bold text-white"
          >
            Prove MTA server control
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            NEXUS can verify control without installing an agent. Temporarily
            place a one-time token in the live MTA server name, then verify it
            against the official master-list.
          </p>
        </div>
      </div>

      {!challenge ? (
        <button
          type="button"
          onClick={() => void issue()}
          disabled={state === "issuing"}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-bold text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
        >
          {state === "issuing" && (
            <LoaderCircle
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          )}
          {state === "issuing" ? "Creating challenge..." : "Create control challenge"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Add this exact token to the server name
            </div>
            <code className="mt-2 block select-all break-all font-mono text-sm font-bold text-blue-200">
              {challenge.token}
            </code>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-neutral-400">
            <li>Temporarily add the token to the name of {serverName}.</li>
            <li>Keep the server visible and responding in the official MTA master-list.</li>
            <li>Click Verify control before the challenge expires.</li>
          </ol>

          <p className="text-[10px] text-neutral-500">
            Expires at {new Date(challenge.expiresAt).toISOString()}. The
            plaintext token is not stored by NEXUS and will be lost if this
            page is reloaded.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void verify()}
              disabled={state === "verifying"}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {state === "verifying" && (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {state === "verifying" ? "Checking master-list..." : "Verify control"}
            </button>
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setState("idle");
                setError(null);
              }}
              disabled={state === "verifying"}
              className="min-h-10 rounded-lg border border-base bg-neutral-900 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {requiresLogin && (
        <p className="text-xs text-neutral-300">
          <Link href="/auth/login" className="font-semibold text-blue-300 hover:underline">
            Sign in
          </Link>{" "}
          to create or verify a server control challenge.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-amber-300">
          {error}
        </p>
      )}

      <p className="text-[10px] leading-relaxed text-neutral-600">
        Master-list presence alone is not treated as proof. NEXUS requires the
        one-time token to appear on the exact server endpoint in a fresh
        directory snapshot.
      </p>
    </section>
  );
}
