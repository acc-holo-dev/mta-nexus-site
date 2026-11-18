import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { getDictionary, type Locale } from "../../../lib/platform/i18n";

export function PlatformSessionError({
  locale,
  title,
  message,
  retryHref,
}: {
  locale: Locale;
  title: string;
  message: string;
  retryHref: string;
}) {
  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-4 overflow-x-clip">
      <h1 className="font-display text-primary">{title}</h1>
      <ErrorState
        title={message}
        description={getDictionary(locale).errors.sessionRetryHint}
        action={
          <Link
            href={retryHref}
            className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
          >
            {getDictionary(locale).errors.retry}
          </Link>
        }
      />
    </div>
  );
}
