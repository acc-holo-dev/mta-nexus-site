import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { linkAccentSmRounded } from "../link-shell";
import { pageShellMax5xlDenseTight } from "../page-shell";

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
    <div className={pageShellMax5xlDenseTight}>
      <h1 className="font-display text-primary">{title}</h1>
      <ErrorState
        title={message}
        description={getDictionary(locale).errors.sessionRetryHint}
        action={
          <Link href={retryHref} className={linkAccentSmRounded}>
            {getDictionary(locale).errors.retry}
          </Link>
        }
      />
    </div>
  );
}
