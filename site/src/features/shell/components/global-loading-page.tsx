"use client";

import { HonestLoadingShell } from "../honest-loading";
import { useNexusLocale } from "../locale";
import { pageShellMax7xl } from "../page-shell";
import { skelH20, skelH24 } from "../skeleton-shell";

const PLACEHOLDER_KEYS = [1, 2, 3] as const;

export function GlobalLoadingPage() {
  const { dictionary } = useNexusLocale();

  return (
    <HonestLoadingShell
      className={pageShellMax7xl}
      headingId="global-loading-heading"
      title={dictionary.errors.loading}
      loadingLabel={dictionary.errors.loading}
      headerClassName=""
      titleClassName="sr-only"
      statusClassName="sr-only"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-8 w-64 rounded-md bg-inset" />
        <div className={skelH24} />
        {PLACEHOLDER_KEYS.map((key) => (
          <div key={key} className={skelH20} />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
