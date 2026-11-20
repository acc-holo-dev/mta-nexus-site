"use client";

import { HonestLoadingShell } from "../honest-loading";
import { useNexusLocale } from "../locale";

const PLACEHOLDER_KEYS = [1, 2, 3] as const;

export function GlobalLoadingPage() {
  const { dictionary } = useNexusLocale();

  return (
    <HonestLoadingShell
      className="mx-auto min-w-0 max-w-7xl space-y-6 overflow-x-clip"
      headingId="global-loading-heading"
      title={dictionary.errors.loading}
      loadingLabel={dictionary.errors.loading}
      headerClassName=""
      titleClassName="sr-only"
      statusClassName="sr-only"
    >
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-8 w-64 rounded-md bg-inset" />
        <div className="h-24 rounded bg-inset" />
        {PLACEHOLDER_KEYS.map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </HonestLoadingShell>
  );
}
