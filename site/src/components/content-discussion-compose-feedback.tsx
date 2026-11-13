import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { getDiscussionCopy } from "../lib/content-discussion-copy";
import type { Locale } from "../lib/i18n";
import { GuestAuthLinks, platformSignInFocusClass } from "./guest-auth-links";

export function DiscussionComposeWriteFeedback({
  error,
  needsSignIn,
  loginHref,
  signInLabel,
  registerHref,
  registerLabel,
  onPersistDraft,
  locale = "en",
}: {
  error: string;
  needsSignIn: boolean;
  loginHref: string;
  signInLabel: string;
  registerHref?: string;
  registerLabel?: string;
  onPersistDraft: () => void;
  locale?: Locale;
}) {
  if (!error) return null;
  const copy = getDiscussionCopy(locale);
  return (
    <ErrorState
      title={error}
      description={copy.formErrorHint}
      className="items-stretch py-4"
      action={
        needsSignIn ? (
          registerHref && registerLabel ? (
            <GuestAuthLinks
              loginHref={loginHref}
              registerHref={registerHref}
              signInLabel={signInLabel}
              createAccountLabel={registerLabel}
              onLoginClick={onPersistDraft}
              onRegisterClick={onPersistDraft}
            />
          ) : (
            <Link
              href={loginHref}
              className={`inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white underline-offset-4 hover:underline ${platformSignInFocusClass}`}
              onClick={onPersistDraft}
            >
              {signInLabel}
            </Link>
          )
        ) : undefined
      }
    />
  );
}
