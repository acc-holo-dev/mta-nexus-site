"use client";

import { Button, ErrorState, Input } from "@nexus/ui";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { recoveryJsonRequest } from "../../../features/accounts/account-recovery-browser";
import { authPasswordResetApiCopy } from "../../../features/accounts/auth-password-reset-api-copy";
import { useNexusLocale } from "../../../features/shell/locale";

const pageShellClass = "mx-auto min-w-0 max-w-md overflow-x-clip py-12";
const navLinkClass =
  "inline-flex min-h-11 items-center text-sm font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export default function ForgotPasswordPage() {
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.recovery;
  const apiCopy = authPasswordResetApiCopy(locale);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setNotice(null);
    try {
      const response = await fetch(
        "/api/auth/password-reset",
        recoveryJsonRequest("POST", { email: email.trim() }),
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.accepted !== true) {
        throw new Error(
          data?.code === "VALIDATION_ERROR" || data?.code === "INVALID_BODY_LENGTH"
            ? apiCopy.invalidBody
            : data?.code === "RATE_LIMIT_EXCEEDED"
              ? apiCopy.requestUnavailable
              : copy.unavailable,
        );
      }
      setNotice({ error: false, text: copy.accepted });
    } catch (error: unknown) {
      setNotice({
        error: true,
        text: error instanceof Error && error.message ? error.message : copy.unavailable,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={pageShellClass}>
      <section
        aria-labelledby="forgot-heading"
        className="nexus-panel min-w-0 space-y-5 overflow-x-clip p-6 shadow-nexus-sm"
      >
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-accent" aria-hidden="true" />
          <h1 id="forgot-heading" className="font-display text-primary">
            {copy.forgotTitle}
          </h1>
        </div>

        <p className="text-sm leading-relaxed text-muted">{copy.forgotDescription}</p>

        <form onSubmit={submit} aria-busy={pending ? true : undefined} className="space-y-4">
          <Input
            id="reset-email"
            name="email"
            type="email"
            label={copy.email}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            maxLength={320}
            disabled={pending}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Button type="submit" size="lg" isLoading={pending} className="w-full min-h-11">
            {pending ? copy.submitting : copy.sendReset}
          </Button>
        </form>

        {notice?.error ? (
          <ErrorState title={notice.text} description={dictionary.errors.formErrorHint} />
        ) : notice ? (
          <p
            role="status"
            className="rounded-lg border border-[color:var(--nexus-success)]/25 bg-success-soft p-3 text-sm text-success"
          >
            {notice.text}
          </p>
        ) : null}

        <Link href="/auth/login" className={navLinkClass}>
          {copy.backToSignIn}
        </Link>
      </section>
    </div>
  );
}
