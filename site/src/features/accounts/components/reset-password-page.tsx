"use client";

import { Button, ErrorState, Input } from "@nexus/ui";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { linkAccentSmSemibold } from "../../shell/link-shell";
import { useNexusLocale } from "../../shell/locale";
import { pageShellMaxMd as pageShellClass } from "../../shell/page-shell";
import { panelClipSpace5P6Shadow } from "../../shell/panel-shell";
import {
  typeDisplayPrimary,
  typeFlexCenterGap3,
  typeIcon5Accent,
  typeSmLeadingMuted,
  typeSmMuted,
  typeSmSuccess,
  typeWFullMinH11,
} from "../../shell/type-shell";
import {
  type AccountRecoveryProof,
  readAccountRecoveryProofFromWindow,
  recoveryJsonRequest,
} from "../account-recovery-browser";
import { authPasswordResetApiCopy } from "../auth-password-reset-api-copy";

type Proof = AccountRecoveryProof;
type State =
  | { kind: "loading" }
  | { kind: "ready"; proof: Proof }
  | { kind: "submitting"; proof: Proof }
  | { kind: "invalid" }
  | { kind: "error"; proof?: Proof; message: string }
  | { kind: "success" };

export function ResetPasswordPage() {
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.recovery;
  const apiCopy = authPasswordResetApiCopy(locale);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(apiCopy)].includes(text) ? text : fallback;
  }
  const [state, setState] = useState<State>({ kind: "loading" });
  const [passwords, setPasswords] = useState({ next: "", confirm: "" });

  useEffect(() => {
    const proof = readAccountRecoveryProofFromWindow();
    setState(proof ? { kind: "ready", proof } : { kind: "invalid" });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind !== "ready" && state.kind !== "error") return;
    if (!state.proof) return;

    if (passwords.next !== passwords.confirm) {
      setState({
        kind: "error",
        proof: state.proof,
        message: copy.passwordsMismatch,
      });
      return;
    }

    const proof = state.proof;
    setState({ kind: "submitting", proof });

    try {
      const response = await fetch(
        "/api/auth/password-reset",
        recoveryJsonRequest("PATCH", {
          ...proof,
          newPassword: passwords.next,
        }),
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.success !== true) {
        if (response.status >= 400 && response.status < 500) {
          setPasswords({ next: "", confirm: "" });
          setState({ kind: "invalid" });
          return;
        }
        throw new Error(
          data?.code === "VALIDATION_ERROR" || data?.code === "INVALID_BODY_LENGTH"
            ? apiCopy.invalidBody
            : apiCopy.confirmUnavailable || copy.resetFailed,
        );
      }

      setPasswords({ next: "", confirm: "" });
      setState({ kind: "success" });
    } catch (error: unknown) {
      setState({
        kind: "error",
        proof,
        message: safeMessage(error, copy.resetFailed),
      });
    }
  }

  const proof =
    state.kind === "ready" || state.kind === "submitting" || state.kind === "error"
      ? state.proof
      : undefined;

  return (
    <div className={pageShellClass}>
      <section aria-labelledby="reset-heading" className={panelClipSpace5P6Shadow}>
        <div className={typeFlexCenterGap3}>
          <ShieldCheck className={typeIcon5Accent} aria-hidden="true" />
          <h1 id="reset-heading" className={typeDisplayPrimary}>
            {copy.resetTitle}
          </h1>
        </div>

        {state.kind === "loading" && (
          <p role="status" className={typeSmMuted}>
            {copy.checkingReset}
          </p>
        )}

        {state.kind === "invalid" && (
          <ErrorState
            title={copy.invalidReset}
            description={copy.invalidResetHint}
            action={
              <Link href="/auth/forgot-password" className={linkAccentSmSemibold}>
                {copy.requestNew}
              </Link>
            }
          />
        )}

        {proof && state.kind !== "success" && (
          <form
            onSubmit={submit}
            aria-label={copy.resetTitle}
            aria-busy={state.kind === "submitting" ? true : undefined}
            className="space-y-4"
          >
            <p className={typeSmLeadingMuted}>{copy.resetDescription}</p>

            {state.kind === "error" && (
              <ErrorState title={state.message} description={copy.resetErrorHint} />
            )}

            <Input
              id="reset-new-password"
              type="password"
              label={copy.newPassword}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              disabled={state.kind === "submitting"}
              value={passwords.next}
              onChange={(event) => setPasswords({ ...passwords, next: event.target.value })}
            />

            <Input
              id="reset-confirm-password"
              type="password"
              label={copy.confirmPassword}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              disabled={state.kind === "submitting"}
              value={passwords.confirm}
              onChange={(event) =>
                setPasswords({
                  ...passwords,
                  confirm: event.target.value,
                })
              }
            />

            <Button
              type="submit"
              size="lg"
              isLoading={state.kind === "submitting"}
              className={typeWFullMinH11}
            >
              {state.kind === "submitting" ? copy.resetting : copy.reset}
            </Button>
          </form>
        )}

        {state.kind === "success" && (
          <>
            <p role="status" className={typeSmSuccess}>
              {copy.resetSuccess}
            </p>
            <Link href="/auth/login" className={linkAccentSmSemibold}>
              {copy.signIn}
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
