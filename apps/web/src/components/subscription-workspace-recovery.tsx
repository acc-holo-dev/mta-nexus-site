import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import type { Locale } from "../lib/i18n";
import { getDictionary } from "../lib/i18n";
import { subscriptionsCopy } from "../lib/subscriptions-i18n";

export const subscriptionPageShellClass =
  "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
export const subscriptionNavLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export function SubscriptionLoadError({
  locale,
  backHref,
  backLabel,
  retryHref,
}: {
  locale: Locale;
  backHref: string;
  backLabel: string;
  retryHref: string;
}) {
  const copy = subscriptionsCopy(locale),
    dictionary = getDictionary(locale);
  return (
    <div className={subscriptionPageShellClass}>
      <Link href={backHref} className={subscriptionNavLinkClass}>
        {backLabel}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        action={
          <Link href={retryHref} className={subscriptionNavLinkClass}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </div>
  );
}
