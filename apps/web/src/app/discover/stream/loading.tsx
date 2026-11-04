import { discoveryStreamCopy } from "../../../lib/discovery-stream-copy";
import { getRequestLocale } from "../../../lib/i18n-server";

// Honest loading shell for /discover/stream.
export default async function Loading() {
  const copy = discoveryStreamCopy(await getRequestLocale());
  return (
    <section
      className="mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip"
      aria-busy="true"
      aria-labelledby="discover-stream-loading-heading"
    >
      <header className="border-b border-base pb-6">
        <h1 id="discover-stream-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p role="status" aria-live="polite" className="mt-2 text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-24 rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
