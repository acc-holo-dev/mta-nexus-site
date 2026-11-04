"use client";

import { Button, ErrorState, Input } from "@nexus/ui";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { getDictionary, type Locale } from "../lib/i18n";
import { authEntryHref, parseAuthReturnPath, resolveAuthReturnPath } from "./auth-return-path";

type AuthMode = "login" | "register";

const pageShellClass = "mx-auto min-w-0 max-w-md space-y-6 overflow-x-clip px-4 py-10 sm:px-0";
const navLinkClass =
  "inline-flex min-h-11 items-center font-semibold text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function responseError(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback;
  const data = value as { error?: unknown; details?: Record<string, { _errors?: unknown }> };
  const fieldErrors = ["email", "username", "password", "displayName"].flatMap((field) => {
    const errors = data.details?.[field]?._errors;
    return Array.isArray(errors)
      ? errors.filter((error): error is string => typeof error === "string")
      : [];
  });
  if (fieldErrors.length) return fieldErrors.join(" ");
  return typeof data.error === "string" ? data.error : fallback;
}

export function AuthForm({
  mode,
  locale,
  initialReturnPath = null,
}: {
  mode: AuthMode;
  locale: Locale;
  initialReturnPath?: string | null;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.auth;
  const registering = mode === "register";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState<string | null>(initialReturnPath);

  useEffect(() => {
    setReturnPath(parseAuthReturnPath(new URLSearchParams(window.location.search).get("next")));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const username = String(form.get("username") ?? "").trim();
    const displayName = String(form.get("displayName") ?? "").trim();
    const body = registering
      ? { email, username, password, ...(displayName ? { displayName } : {}) }
      : { email, password };
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(responseError(data, copy.genericError));
        setLoading(false);
        return;
      }
      if (data?.success !== true) throw new Error("Invalid authentication response");
      const next = resolveAuthReturnPath(new URLSearchParams(window.location.search).get("next"));
      // Replace the document so a previous account's router cache is not reused.
      // Landing alone must not claim, react, follow, or download.
      window.location.replace(next);
    } catch {
      setError(registering ? copy.registerError : copy.loginError);
      setLoading(false);
    }
  }

  const alternateHref = authEntryHref(registering ? "login" : "register", returnPath);

  return (
    <div className={pageShellClass}>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-primary">
          {registering ? copy.registerTitle : copy.loginTitle}
        </h1>
        <p className="text-sm text-muted">
          {registering ? copy.registerDescription : copy.loginDescription}
        </p>
      </div>
      <form
        onSubmit={submit}
        aria-busy={loading}
        aria-describedby={error ? "auth-error" : undefined}
        className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-5"
      >
        {error ? <ErrorState id="auth-error" title={error} /> : null}
        <Input
          id="auth-email"
          name="email"
          type="email"
          label={copy.email}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          disabled={loading}
        />
        {registering && (
          <>
            <div className="space-y-1.5">
              <Input
                id="auth-username"
                name="username"
                label={copy.username}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                minLength={3}
                maxLength={32}
                pattern="[a-zA-Z0-9_\-]+"
                aria-describedby="username-hint"
                disabled={loading}
              />
              <p id="username-hint" className="text-xs text-muted">
                {copy.usernameHint}
              </p>
            </div>
            <div className="space-y-1.5">
              <Input
                id="auth-display-name"
                name="displayName"
                label={copy.displayName}
                autoComplete="nickname"
                minLength={2}
                maxLength={50}
                aria-describedby="display-name-hint"
                disabled={loading}
              />
              <p id="display-name-hint" className="text-xs text-muted">
                {copy.displayNameHint}
              </p>
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Input
            id="auth-password"
            name="password"
            type="password"
            label={copy.password}
            required
            minLength={registering ? 8 : 1}
            maxLength={128}
            autoComplete={registering ? "new-password" : "current-password"}
            aria-describedby={registering ? "password-hint" : undefined}
            disabled={loading}
          />
          {registering && (
            <p id="password-hint" className="text-xs text-muted">
              {copy.passwordHint}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" isLoading={loading} className="w-full min-h-11">
          {loading
            ? registering
              ? copy.creating
              : copy.signingIn
            : registering
              ? copy.create
              : copy.signIn}
        </Button>
      </form>
      <div className="space-y-2 text-sm text-muted">
        {!registering && (
          <p>
            <Link href="/auth/forgot-password" className={navLinkClass}>
              {copy.forgot}
            </Link>
          </p>
        )}
        <p>
          {registering ? `${copy.already} ` : `${copy.newUser} `}
          <Link href={alternateHref} className={navLinkClass}>
            {registering ? copy.signIn : copy.create}
          </Link>
        </p>
      </div>
    </div>
  );
}
