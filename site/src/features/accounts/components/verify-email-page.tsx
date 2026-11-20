"use client";

import { Button, ErrorState } from "@nexus/ui";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useNexusLocale } from "../../shell/locale";
import { pageShellMaxLg as pageShellClass } from "../../shell/page-shell";
import { panelClipSpace5P6Shadow } from "../../shell/panel-shell";
import {
  type AccountRecoveryProof,
  readAccountRecoveryProofFromWindow,
  recoveryJsonRequest,
} from "../account-recovery-browser";
import { authEmailVerificationApiCopy } from "../auth-email-verification-api-copy";

import { linkAccentSmSemibold } from "../../shell/link-shell";
type Proof = AccountRecoveryProof;
type State =
  | { kind: "loading" }
  | { kind: "ready"; proof: Proof }
  | { kind: "invalid" }
  | { kind: "submitting"; proof: Proof }
  | { kind: "success"; email: string }
  | { kind: "error"; proof?: Proof; message: string };

const retryButtonClass =
  "h-auto min-h-11 px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function VerifyEmailPage() {
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.recovery;
  const apiCopy = authEmailVerificationApiCopy(locale);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(apiCopy)].includes(text) ? text : fallback;
  }
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
        throw new Error(
          data?.code === "UNAUTHORIZED" || data?.code === "ACTOR_ID_REQUIRED"
            ? apiCopy.authenticationRequired
            : data?.code === "ACTOR_CHANGED" || data?.code === "ACCOUNT_CHANGED"
              ? apiCopy.accountChanged
              : data?.code === "VALIDATION_ERROR"
                ? apiCopy.validationFailed
                : apiCopy.confirmFailed || copy.verifyFailed,
        );
      }

      setState({ kind: "success", email: data.email });
    } catch (error: unknown) {
      setState({
        kind: "error",
        proof,
        message: safeMessage(error, copy.verifyFailed),
      });
    }
  }

  return (
    <div className={pageShellClass}>
      <section aria-labelledby="verify-email-heading" className={panelClipSpace5P6Shadow}>
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
            description={copy.invalidVerificationHint}
            action={
              <Link href="/settings" className={linkAccentSmSemibold}>
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
              description={copy.verifyErrorHint}
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
            <Link href="/settings" className={linkAccentSmSemibold}>
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
            <Link href="/settings" className={linkAccentSmSemibold}>
              {copy.backToSettings}
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
