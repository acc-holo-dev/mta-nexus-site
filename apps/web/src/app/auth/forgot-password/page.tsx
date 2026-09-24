"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.accepted !== true) {
        throw new Error(data?.error || "Password reset is temporarily unavailable.");
      }
      setNotice({
        error: false,
        text: "If an eligible account uses that email, a password reset link will be sent.",
      });
    } catch (error: unknown) {
      setNotice({
        error: true,
        text: error instanceof Error ? error.message : "Password reset is temporarily unavailable.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-12">
      <section aria-labelledby="forgot-heading" className="nexus-panel space-y-5 p-6">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-accent" aria-hidden="true" />
          <h1 id="forgot-heading" className="font-display text-primary">Forgot password</h1>
        </div>
        <p className="text-sm text-muted">
          Enter your account email. For privacy, the response is the same whether or not that address can be used for recovery.
        </p>
        <form onSubmit={submit} aria-busy={pending} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reset-email" className="block text-sm font-semibold text-primary">Email address</label>
            <input id="reset-email" name="email" type="email" autoComplete="email" autoCapitalize="none"
              spellCheck={false} required maxLength={320} disabled={pending} value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-base bg-inset px-3 py-2.5 text-sm text-primary" />
          </div>
          <button type="submit" disabled={pending}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? "Submitting..." : "Send reset link"}
          </button>
        </form>
        {notice && <p role={notice.error ? "alert" : "status"}
          className="rounded-lg border border-base p-3 text-sm text-primary">{notice.text}</p>}
        <Link href="/auth/login" className="text-sm font-semibold text-accent underline">Back to sign in</Link>
      </section>
    </div>
  );
}
