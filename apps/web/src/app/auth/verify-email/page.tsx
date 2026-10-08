"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@nexus/ui";
import { useNexusLocale } from "../../../components/locale-context";
import {
  readAccountRecoveryProofFromWindow,
  recoveryJsonRequest,
  type AccountRecoveryProof,
} from "../../../lib/account-recovery-browser";

type Proof = AccountRecoveryProof;
type State =
  | { kind: "loading" }
  | { kind: "ready"; proof: Proof }
  | { kind: "invalid" }
  | { kind: "submitting"; proof: Proof }
  | { kind: "success"; email: string }
  | { kind: "error"; proof?: Proof; message: string };

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

      if (
        !response.ok ||
        data?.success !== true ||
        typeof data.email !== "string"
      ) {
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
        message:
          error instanceof Error && error.message
            ? error.message
            : copy.verifyFailed,
      });
    }
  }

  return (
    <div className="mx-auto max-w-lg py-16">
      <section
        aria-labelledby="verify-email-heading"
        className="nexus-panel space-y-5 p-6 shadow-nexus-sm"
      >
        <div className="flex items-center gap-3">
          <MailCheck className="h-5 w-5 text-accent" aria-hidden="true" />
          <h1
            id="verify-email-heading"
            className="font-display text-primary"
          >
            {copy.verifyTitle}
          </h1>
        </div>

        {state.kind === "loading" && (
          <p role="status" className="text-sm text-muted">
            {copy.checkingVerification}
          </p>
        )}

        {state.kind === "invalid" && (
          <>
            <p role="alert" className="text-sm text-muted">
              {copy.invalidVerification}
            </p>
            <Link
              href="/settings"
              className="inline-block text-sm font-semibold text-accent hover:underline"
            >
              {copy.backToSettings}
            </Link>
          </>
        )}

        {(state.kind === "ready" || state.kind === "submitting") && (
          <>
            <p className="text-sm leading-relaxed text-muted">
              {copy.verifyDescription}
            </p>
            <Button
              type="button"
              isLoading={state.kind === "submitting"}
              onClick={() => void confirm(state.proof)}
            >
              {state.kind === "submitting"
                ? copy.confirming
                : copy.confirmEmail}
            </Button>
          </>
        )}

        {state.kind === "error" && (
          <>
            <p
              role="alert"
              className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-3 text-sm text-danger"
            >
              {state.message}
            </p>
            {state.proof && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (state.kind === "error" && state.proof) void confirm(state.proof);
                }}
              >
                {copy.retry}
              </Button>
            )}
            <Link
              href="/settings"
              className="block text-sm font-semibold text-accent hover:underline"
            >
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
            <Link
              href="/settings"
              className="inline-block text-sm font-semibold text-accent hover:underline"
            >
              {copy.backToSettings}
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
