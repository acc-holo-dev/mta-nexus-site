"use client";

import { useNexusLocale } from "../components/locale-context";

const PLACEHOLDER_IDS = ["first", "second", "third", "fourth"] as const;

export default function GlobalLoading() {
  const { dictionary } = useNexusLocale();

  return (
    <div
      className="mx-auto max-w-7xl space-y-6"
      role="status"
      aria-label={dictionary.errors.loading}
    >
      <div className="h-8 w-64 animate-pulse rounded-md bg-inset" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {PLACEHOLDER_IDS.map((id) => (
          <div key={id} className="nexus-panel space-y-2 p-4">
            <div className="h-3 w-20 animate-pulse rounded bg-inset" />
            <div className="h-7 w-16 animate-pulse rounded bg-inset" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_IDS.map((id) => (
          <div key={id} className="nexus-panel overflow-hidden">
            <div className="aspect-video animate-pulse bg-inset" />
            <div className="space-y-2 p-4">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-inset" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-inset" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
