"use client";

import { Button, ErrorState, Input } from "@nexus/ui";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { linkAccentSmSemibold } from "../../shell/link-shell";
import { useNexusLocale } from "../../shell/locale";
import { pageShellMaxMd as pageShellClass } from "../../shell/page-shell";
import { panelClipSpace5P6Shadow } from "../../shell/panel-shell";
import { typeDisplayPrimary } from "../../shell/type-shell";
import { recoveryJsonRequest } from "../account-recovery-browser";
import { authPasswordResetApiCopy } from "../auth-password-reset-api-copy";
export function ForgotPasswordPage() {
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.recovery;
  const apiCopy = authPasswordResetApiCopy(locale);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(apiCopy)].includes(text) ? text : fallback;
  }
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
            : data?.code === "RATE_LIMIT_EXCEEDED" || data?.code === "RATE_LIMITED"
              ? apiCopy.requestUnavailable
              : copy.unavailable,
        );
      }
      setNotice({ error: false, text: copy.accepted });
    } catch (error: unknown) {
      setNotice({
        error: true,
        text: safeMessage(error, copy.unavailable),
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={pageShellClass}>
      <section aria-labelledby="forgot-heading" className={panelClipSpace5P6Shadow}>
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-accent" aria-hidden="true" />
          <h1 id="forgot-heading" className={typeDisplayPrimary}>
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

        <Link href="/auth/login" className={linkAccentSmSemibold}>
          {copy.backToSignIn}
        </Link>
      </section>
    </div>
  );
}
