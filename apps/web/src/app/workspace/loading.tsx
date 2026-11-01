import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n-server";

// Honest loading shell for /workspace.
export default async function WorkspaceLoading() {
  const copy = getDictionary(await getRequestLocale()).workspace;
  return (
    <section
      className="mx-auto max-w-7xl space-y-6"
      aria-busy="true"
      aria-labelledby="workspace-loading-heading"
    >
      <header className="border-b border-base pb-6">
        <h1 id="workspace-loading-heading" className="text-2xl font-extrabold text-primary">
          {copy.title}
        </h1>
        <p role="status" className="mt-2 text-sm text-muted">
          {copy.loading}
        </p>
      </header>
      <div className="animate-pulse space-y-4" aria-hidden="true">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((key) => (
            <div key={key} className="nexus-panel h-24 rounded bg-inset" />
          ))}
        </div>
        <div className="h-40 rounded bg-inset" />
        {[1, 2].map((key) => (
          <div key={key} className="h-28 rounded bg-inset" />
        ))}
      </div>
    </section>
  );
}
