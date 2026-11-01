import Link from "next/link";

export function DiscussionComposeWriteFeedback({
  error,
  needsSignIn,
  loginHref,
  signInLabel,
  onPersistDraft,
}: {
  error: string;
  needsSignIn: boolean;
  loginHref: string;
  signInLabel: string;
  onPersistDraft: () => void;
}) {
  if (!error) return null;
  return (
    <div className="space-y-2">
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
      {needsSignIn ? (
        <Link
          href={loginHref}
          className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)]"
          onClick={onPersistDraft}
        >
          {signInLabel}
        </Link>
      ) : null}
    </div>
  );
}
