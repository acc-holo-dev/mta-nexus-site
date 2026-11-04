"use client";

import { Button, ErrorState } from "@nexus/ui";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNexusLocale } from "../../../components/locale-context";
import {
  type AccountRecoveryProof,
  readAccountRecoveryProofFromWindow,
  recoveryJsonRequest,
} from "../../../lib/account-recovery-browser";

type Proof = AccountRecoveryProof;
type State =
  | { kind: "loading" }
  | { kind: "ready"; proof: Proof }
  | { kind: "invalid" }
  | { kind: "submitting"; proof: Proof }
  | { kind: "success"; email: string }
  | { kind: "error"; proof?: Proof; message: string };

const pageShellClass = "mx-auto min-w-0 max-w-lg overflow-x-clip py-16";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
const retryButtonClass =
  "h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default function VerifyEmailPage() {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.recovery;
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const proof = readAccountRecoveryProofFromWindow();
    setState(proof ? { kind: "ready", proof } : { kind: "invalid" });
  }, []);

  async function confirm(proof: Proof) {
    setState({ kind: "submitting", proof });

    try {
      const response = await fetch(
        "/api/auth/email-verification",
        recoveryJsonRequest("PATCH", proof),
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success !== true || typeof data.email !== "string") {
        if (response.status >= 400 && response.status < 500) {
          setState({ kind: "invalid" });
          return;
        }
        throw new Error(data?.error || copy.verifyFailed);
      }

      setState({ kind: "success", email: data.email });
    } catch (error: unknown) {
      setState({
        kind: "error",
        proof,
        message: error instanceof Error && error.message ? error.message : copy.verifyFailed,
      });
    }
  }

  return (
    <div className={pageShellClass}>
      <section
        aria-labelledby="verify-email-heading"
        className="nexus-panel min-w-0 space-y-5 overflow-x-clip p-6 shadow-nexus-sm"
      >
        <div className="flex items-center gap-3">
          <MailCheck className="h-5 w-5 text-accent" aria-hidden="true" />
          <h1 id="verify-email-heading" className="font-display text-primary">
            {copy.verifyTitle}
          </h1>
        </div>

        {state.kind === "loading" && (
          <p role="status" className="text-sm text-muted">
            {copy.checkingVerification}
          </p>
        )}

        {state.kind === "invalid" && (
          <ErrorState
            title={copy.invalidVerification}
            action={
              <Link href="/settings" className={navLinkClass}>
                {copy.backToSettings}
              </Link>
            }
          />
        )}

        {(state.kind === "ready" || state.kind === "submitting") && (
          <>
            <p className="text-sm leading-relaxed text-muted">{copy.verifyDescription}</p>
            <Button
              type="button"
              className="min-h-11"
              isLoading={state.kind === "submitting"}
              onClick={() => void confirm(state.proof)}
            >
              {state.kind === "submitting" ? copy.confirming : copy.confirmEmail}
            </Button>
          </>
        )}

        {state.kind === "error" && (
          <>
            <ErrorState
              title={state.message}
              action={
                state.proof ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className={retryButtonClass}
                    onClick={() => {
                      if (state.kind === "error" && state.proof) void confirm(state.proof);
                    }}
                  >
                    {copy.retry}
                  </Button>
                ) : undefined
              }
            />
            <Link href="/settings" className={navLinkClass}>
              {copy.backToSettings}
            </Link>
          </>
        )}

        {state.kind === "success" && (
          <>
            <p role="status" className="text-sm text-success">
              {copy.verifiedPrefix} {state.email}
            </p>
            <p className="text-xs text-muted">{copy.confirmationConsumed}</p>
            <Link href="/settings" className={navLinkClass}>
              {copy.backToSettings}
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
