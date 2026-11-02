"use client";

import { useNexusLocale } from "../components/locale-context";

const PLACEHOLDER_KEYS = [1, 2, 3] as const;

export default function GlobalLoading() {
  const { dictionary } = useNexusLocale();

  return (
    <div
      className="mx-auto max-w-7xl space-y-6"
      role="status"
      aria-busy="true"
      aria-labelledby="global-loading-heading"
    >
      <h1 id="global-loading-heading" className="sr-only">
        {dictionary.errors.loading}
      </h1>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-8 w-64 rounded-md bg-inset" />
        <div className="h-24 rounded bg-inset" />
        {PLACEHOLDER_KEYS.map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </div>
  );
}
