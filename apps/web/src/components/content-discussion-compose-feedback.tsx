import Link from "next/link";

const platformSignInFocusClass =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

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
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={loginHref}
            className={`inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-white underline-offset-4 hover:underline ${platformSignInFocusClass}`}
            onClick={onPersistDraft}
          >
            {signInLabel}
          </Link>
          {registerHref && registerLabel ? (
            <Link
              href={registerHref}
              className={`inline-flex min-h-11 items-center text-sm text-secondary underline ${platformSignInFocusClass}`}
              onClick={onPersistDraft}
            >
              {registerLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
