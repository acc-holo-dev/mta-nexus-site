import { getRequestLocale } from "../../../lib/i18n-server";
import { followCopy } from "../../../lib/follow-workspace-copy";

export default async function Loading() {
  const copy = followCopy(await getRequestLocale());
  return (
    <div className="space-y-6" aria-busy="true">
      <header className="border-b border-base pb-6">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p role="status" className="mt-2 text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="h-10 w-full max-w-md rounded bg-inset" />
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-24 rounded bg-inset" />
        ))}
      </div>
    </div>
  );
}
