"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";
import { useState } from "react";
import {
  confirmsServerClaimVerification,
  parseIssuedServerClaimChallenge,
  type IssuedServerClaimChallenge,
} from "../lib/server-claim-confirmation";
import { serverClaimErrorMessage } from "../lib/server-claim-status-view";
import { privateApiRequest } from "../lib/private-api-request";
import { useNexusLocale } from "./locale-context";

export function ServerClaimControlPanel({
  serverId,
  serverName,
  refreshOnSuccess = false,
}: {
  serverId: string;
  serverName: string;
  refreshOnSuccess?: boolean;
}) {
  const router = useRouter();
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.serverClaim;
  const [challenge, setChallenge] = useState<IssuedServerClaimChallenge | null>(null);
  const [state, setState] = useState<"idle" | "issuing" | "issued" | "verifying" | "verified">(
    "idle",
  );
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
        privateApiRequest({
          method: "POST",
          timeoutMs: 10_000,
        }),
      );
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        setRequiresLogin(true);
        setState("idle");
        return;
      }
      const issued = parseIssuedServerClaimChallenge(response.status, data, serverId);
      if (!issued) {
        setError(serverClaimErrorMessage(data, locale, copy.createError));
        setState("idle");
        return;
      }

      setChallenge(issued);
      setState("issued");
    } catch {
      setError(copy.createUnavailable);
      setState("idle");
    }
  }

  async function verify() {
    if (!challenge || state !== "issued") return;
    setState("verifying");
    setError(null);

    try {
      const response = await fetch(
        `/api/servers/${encodeURIComponent(serverId)}/claim-challenge/verify`,
        privateApiRequest({
          method: "POST",
          json: {
            challengeId: challenge.challengeId,
            token: challenge.token,
          },
          timeoutMs: 15_000,
        }),
      );
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        setRequiresLogin(true);
        setState("issued");
        return;
      }
      if (!confirmsServerClaimVerification(response.status, data, challenge.challengeId)) {
        setError(serverClaimErrorMessage(data, locale, copy.proofRejected));
        setState("issued");
        return;
      }

      setState("verified");
      if (refreshOnSuccess) router.refresh();
    } catch {
      setError(copy.verifyUnavailable);
      setState("issued");
    }
  }

  if (state === "verified") {
    return (
      <section className="nexus-panel space-y-2 border-[color:var(--nexus-success)]/20 p-5">
        <div className="flex items-center gap-2 text-success">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <h2 className="text-sm font-bold">{copy.verifiedTitle}</h2>
        </div>
        <p className="text-xs leading-relaxed text-muted">{copy.verifiedDescription}</p>
        <p className="text-[10px] text-faint">{copy.moderationSeparate}</p>
      </section>
    );
  }

  return (
    <section className="nexus-panel space-y-4 p-5" aria-labelledby="server-control-proof-heading">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <div>
          <h2 id="server-control-proof-heading" className="text-sm font-bold text-primary">
            {copy.title}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{copy.description}</p>
        </div>
      </div>

      {!challenge ? (
        <button
          type="button"
          onClick={() => void issue()}
          disabled={state === "issuing"}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[color:var(--nexus-accent)]/30 bg-accent-soft px-4 py-2 text-xs font-bold text-accent transition-colors hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] disabled:opacity-50"
        >
          {state === "issuing" && (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          {state === "issuing" ? copy.creating : copy.create}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-[color:var(--nexus-accent)]/20 bg-accent-soft p-3">
            <div className="font-label uppercase text-muted">{copy.tokenLabel}</div>
            <code className="mt-2 block select-all break-all font-mono text-sm font-bold text-accent">
              {challenge.token}
            </code>
          </div>

          <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted">
            <li>
              {copy.stepAddToken} <strong>{serverName}</strong>
            </li>
            <li>{copy.stepKeepVisible}</li>
            <li>{copy.stepVerify}</li>
          </ol>

          <p className="text-[10px] text-faint">
            {copy.expires}{" "}
            {new Date(challenge.expiresAt).toLocaleString(locale === "ru" ? "ru-RU" : "en-US")}.{" "}
            {copy.tokenEphemeral}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void verify()}
              disabled={state === "verifying"}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-success-solid px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-success)] disabled:opacity-50"
            >
              {state === "verifying" && (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {state === "verifying" ? copy.checking : copy.verify}
            </button>
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setState("idle");
                setError(null);
              }}
              disabled={state === "verifying"}
              className="min-h-10 rounded-lg border border-base bg-surface px-4 py-2 text-xs font-semibold text-secondary transition-colors hover:bg-hover hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)] disabled:opacity-50"
            >
              {copy.startOver}
            </button>
          </div>
        </div>
      )}

      {requiresLogin && (
        <p className="text-xs text-secondary">
          <Link href="/auth/login" className="font-semibold text-accent hover:underline">
            {copy.signIn}
          </Link>{" "}
          {copy.signInHint}
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-warning">
          {error}
        </p>
      )}

      <p className="text-[10px] leading-relaxed text-faint">{copy.exactEndpoint}</p>
    </section>
  );
}
