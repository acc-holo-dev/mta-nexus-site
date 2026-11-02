"use client";

import { usePathname } from "next/navigation";
import { getDictionary, type Locale } from "../lib/i18n";
import { authEntryHref } from "./auth-return-path";
import { GuestAuthLinks } from "./guest-auth-links";

export function PlatformSignIn({
  locale,
  returnPath,
}: {
  locale: Locale;
  returnPath?: string | null;
}) {
  const pathname = usePathname();
  const copy = getDictionary(locale).workspace;
  const nextPath = returnPath !== undefined ? returnPath : pathname;
  return (
    <section className="space-y-4 py-16 text-center">
      <h1 className="font-display text-primary">{copy.signInRequired}</h1>
      {copy.signInMessage ? (
        <p className="mx-auto max-w-md text-sm text-secondary">{copy.signInMessage}</p>
      ) : null}
      <GuestAuthLinks
        loginHref={authEntryHref("login", nextPath)}
        registerHref={authEntryHref("register", nextPath)}
        signInLabel={copy.signIn}
        createAccountLabel={copy.createAccount}
        className="justify-center"
      />
    </section>
  );
}
