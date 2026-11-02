import Link from "next/link";
import { GuestAuthLinks, platformSignInFocusClass } from "./guest-auth-links";

export function DiscussionComposeWriteFeedback({
  error,
  needsSignIn,
  loginHref,
  signInLabel,
  registerHref,
  registerLabel,
  onPersistDraft,
}: {
  error: string;
  needsSignIn: boolean;
  loginHref: string;
  signInLabel: string;
  registerHref?: string;
  registerLabel?: string;
  onPersistDraft: () => void;
}) {
  if (!error) return null;
  return (
    <div className="space-y-2">
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
      {needsSignIn ? (
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
      ) : null}
    </div>
  );
}
