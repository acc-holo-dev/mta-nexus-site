import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";
import { platformSignInFocusClass } from "./guest-auth-links";

export function ResourceSubmissionSuccess({
  resultId,
  locale,
}: {
  resultId: string;
  locale: Locale;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.publishing;

  return (
    <div className="mx-auto max-w-xl space-y-4 py-12">
      <div className="nexus-panel space-y-4 p-6 shadow-nexus-sm">
        <div className="inline-flex rounded-full bg-success-soft px-2.5 py-1 font-label text-success">
          {dictionary.nav.openFreeBeta}
        </div>
        <h1 className="text-2xl font-black text-primary">{copy.submittedTitle}</h1>
        <p className="text-sm leading-relaxed text-muted">{copy.submittedDescription}</p>
        <Link
          href={`/workspace/resources/${encodeURIComponent(resultId)}#publication-readiness`}
          className={`inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--nexus-accent-hover)] ${platformSignInFocusClass}`}
        >
          {copy.openStatus}
        </Link>
        <Link
          href="/workspace/resources"
          className="block text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {dictionary.authorResources.title}
        </Link>
      </div>
    </div>
  );
}
