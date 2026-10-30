"use client";

import { Button, Input } from "@nexus/ui";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useNexusLocale } from "../../../components/locale-context";
import { recoveryJsonRequest } from "../../../lib/account-recovery-browser";

export default function ForgotPasswordPage() {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.recovery;
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
        throw new Error(data?.error || copy.unavailable);
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
    <div className="mx-auto max-w-md py-12">
      <section
        aria-labelledby="forgot-heading"
        className="nexus-panel space-y-5 p-6 shadow-nexus-sm"
      >
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-accent" aria-hidden="true" />
          <h1 id="forgot-heading" className="font-display text-primary">
            {copy.forgotTitle}
          </h1>
        </div>

        <p className="text-sm leading-relaxed text-muted">{copy.forgotDescription}</p>

        <form onSubmit={submit} aria-busy={pending} className="space-y-4">
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

        {notice && (
          <p
            role={notice.error ? "alert" : "status"}
            className={`rounded-lg border p-3 text-sm ${
              notice.error
                ? "border-[color:var(--nexus-danger)]/25 bg-danger-soft text-danger"
                : "border-[color:var(--nexus-success)]/25 bg-success-soft text-success"
            }`}
          >
            {notice.text}
          </p>
        )}

        <Link href="/auth/login" className="text-sm font-semibold text-accent hover:underline">
          {copy.backToSignIn}
        </Link>
      </section>
    </div>
  );
}
