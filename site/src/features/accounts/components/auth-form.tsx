"use client";

import { Button, ErrorState, Input } from "@nexus/ui";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { authEntryHref, parseAuthReturnPath, resolveAuthReturnPath } from "../../shell/auth-return";
import { linkAccentSemibold } from "../../shell/link-shell";
import { pageShellMaxMdAuth } from "../../shell/page-shell";
import { panelClipSpace4P5 } from "../../shell/panel-shell";
import {
  type2xlBoldPrimary,
  typeSmMuted,
  typeSpace2SmMuted,
  typeWFullMinH11,
  typeXsMuted,
} from "../../shell/type-shell";
import { authLoginApiCopy } from "../auth-login-api-copy";
import { authRegisterApiCopy } from "../auth-register-api-copy";

type AuthMode = "login" | "register";

function responseError(
  value: unknown,
  locale: Locale,
  registering: boolean,
  fallback: string,
): string {
  if (!value || typeof value !== "object") return fallback;
  const data = value as {
    code?: unknown;
    details?: Record<string, { _errors?: unknown }>;
  };
  const fieldErrors = ["email", "username", "password", "displayName"].flatMap((field) => {
    const errors = data.details?.[field]?._errors;
    return Array.isArray(errors)
      ? errors.filter((error): error is string => typeof error === "string")
      : [];
  });
  if (fieldErrors.length) return fieldErrors.join(" ");
  if (registering) {
    const copy = authRegisterApiCopy(locale);
    if (data.code === "RATE_LIMIT_EXCEEDED" || data.code === "RATE_LIMITED") return copy.rate;
    if (data.code === "VALIDATION_ERROR") return copy.validationFailed;
    if (data.code === "UNAUTHORIZED") return copy.unauthorized;
    if (data.code === "CONFLICT") return copy.conflict;
    return copy.failed || fallback;
  }
  const copy = authLoginApiCopy(locale);
  if (data.code === "RATE_LIMIT_EXCEEDED" || data.code === "RATE_LIMITED") return copy.rate;
  if (data.code === "UNAUTHORIZED" || data.code === "INVALID_CREDENTIALS") return copy.unauthorized;
  return copy.failed || fallback;
}

export function AuthForm({
  mode,
  locale,
  initialReturnPath = null,
  walletEnabled = false,
}: {
  mode: AuthMode;
  locale: Locale;
  initialReturnPath?: string | null;
  walletEnabled?: boolean;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.auth;
  const registering = mode === "register";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [returnPath, setReturnPath] = useState<string | null>(initialReturnPath);
  const registerDescription =
    walletEnabled && registering ? copy.registerWalletDescription : copy.registerDescription;

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
        setError(responseError(data, locale, registering, copy.genericError));
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
    <div className={pageShellMaxMdAuth}>
      <div className="space-y-2">
        <h1 className={type2xlBoldPrimary}>{registering ? copy.registerTitle : copy.loginTitle}</h1>
        <p className={typeSmMuted}>{registering ? registerDescription : copy.loginDescription}</p>
      </div>
      <form
        onSubmit={submit}
        aria-busy={loading}
        aria-describedby={error ? "auth-error" : undefined}
        className={panelClipSpace4P5}
      >
        {error ? (
          <ErrorState id="auth-error" title={error} description={copy.formErrorHint} />
        ) : null}
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
              <p id="username-hint" className={typeXsMuted}>
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
              <p id="display-name-hint" className={typeXsMuted}>
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
            <p id="password-hint" className={typeXsMuted}>
              {copy.passwordHint}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" isLoading={loading} className={typeWFullMinH11}>
          {loading
            ? registering
              ? copy.creating
              : copy.signingIn
            : registering
              ? copy.create
              : copy.signIn}
        </Button>
      </form>
      <div className={typeSpace2SmMuted}>
        {!registering && (
          <p>
            <Link href="/auth/forgot-password" className={linkAccentSemibold}>
              {copy.forgot}
            </Link>
          </p>
        )}
        <p>
          {registering ? `${copy.already} ` : `${copy.newUser} `}
          <Link href={alternateHref} className={linkAccentSemibold}>
            {registering ? copy.signIn : copy.create}
          </Link>
        </p>
      </div>
    </div>
  );
}
