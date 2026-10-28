"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@nexus/ui";
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
          <label className="block space-y-1.5" htmlFor="reset-email">
            <span className="text-sm font-semibold text-primary">{copy.email}</span>
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              maxLength={320}
              disabled={pending}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-base bg-inset px-3 py-2.5 text-sm text-primary outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]"
            />
          </label>

          <Button type="submit" isLoading={pending} className="w-full">
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
