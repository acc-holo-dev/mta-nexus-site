"use client";

import { Button, ErrorState, Input } from "@nexus/ui";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
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
  | { kind: "submitting"; proof: Proof }
  | { kind: "invalid" }
  | { kind: "error"; proof?: Proof; message: string }
  | { kind: "success" };

const pageShellClass = "mx-auto min-w-0 max-w-md overflow-x-clip py-12";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default function ResetPasswordPage() {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.recovery;
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
        throw new Error(data?.error || copy.resetFailed);
      }

      setPasswords({ next: "", confirm: "" });
      setState({ kind: "success" });
    } catch (error: unknown) {
      setState({
        kind: "error",
        proof,
        message: error instanceof Error && error.message ? error.message : copy.resetFailed,
      });
    }
  }

  const proof =
    state.kind === "ready" || state.kind === "submitting" || state.kind === "error"
      ? state.proof
      : undefined;

  return (
    <div className={pageShellClass}>
      <section
        aria-labelledby="reset-heading"
        className="nexus-panel min-w-0 space-y-5 overflow-x-clip p-6 shadow-nexus-sm"
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
          <h1 id="reset-heading" className="font-display text-primary">
            {copy.resetTitle}
          </h1>
        </div>

        {state.kind === "loading" && (
          <p role="status" className="text-sm text-muted">
            {copy.checkingReset}
          </p>
        )}

        {state.kind === "invalid" && (
          <ErrorState
            title={copy.invalidReset}
            action={
              <Link href="/auth/forgot-password" className={navLinkClass}>
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
            <p className="text-sm leading-relaxed text-muted">{copy.resetDescription}</p>

            {state.kind === "error" && <ErrorState title={state.message} />}

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
              className="w-full min-h-11"
            >
              {state.kind === "submitting" ? copy.resetting : copy.reset}
            </Button>
          </form>
        )}

        {state.kind === "success" && (
          <>
            <p role="status" className="text-sm text-success">
              {copy.resetSuccess}
            </p>
            <Link href="/auth/login" className={navLinkClass}>
              {copy.signIn}
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
