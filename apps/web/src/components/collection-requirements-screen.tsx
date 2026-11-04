import { AppError } from "@nexus/domain";
import { Button, EmptyState, ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { collectionRequirementsCopy } from "../lib/collection-requirements-i18n";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { collectionPageParams } from "../lib/library-collections-query";
import { resourceRequirementsCopy } from "../lib/resource-requirements-i18n";
import { resourceRequirementsQuery } from "../lib/resource-requirements-query";
import { authService } from "../lib/services/auth-service";
import { resourceRequirementsService } from "../lib/services/resource-requirements-service";
import { PlatformSignIn } from "./platform-sign-in";
import { ResourceRequirementsReportBody } from "./resource-requirements-report-body";

export async function CollectionRequirementsScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, path, raw] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const dictionary = getDictionary(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  const requirementsBase = `/workspace/library/collections/${encodeURIComponent(path.id)}/requirements`;
  if (!actor) {
    let returnPath = requirementsBase;
    try {
      const preview = resourceRequirementsQuery(collectionPageParams(raw), "library");
      if (preview.targetMta) {
        returnPath = `${requirementsBase}?${new URLSearchParams({ targetMta: preview.targetMta })}`;
      }
    } catch {
      // Keep the requirements route when query params are invalid for guests.
    }
    return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  }
  let query: ReturnType<typeof resourceRequirementsQuery>;
  try {
    query = resourceRequirementsQuery(collectionPageParams(raw), "library");
  } catch {
    notFound();
  }
  const c = collectionRequirementsCopy(locale);
  const retrySuffix = query.targetMta
    ? `?${new URLSearchParams({ targetMta: query.targetMta })}`
    : "";
  const result = await resourceRequirementsService
    .collectionReport(actor.id, path.id, query)
    .catch((error: unknown) => {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
      return null;
    });
  if (!result) {
    return (
      <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
        <Link
          href={`/workspace/library/collections/${encodeURIComponent(path.id)}`}
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {c.back}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          action={
            <Link
              href={`${requirementsBase}${retrySuffix}`}
              className="inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const copy = resourceRequirementsCopy(locale);
  const suffix = query.targetMta ? `?${new URLSearchParams({ targetMta: query.targetMta })}` : "";
  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8">
      <Link
        href={`/workspace/library/collections/${encodeURIComponent(path.id)}`}
        className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {c.back}
      </Link>
      <h1 className="font-display">{c.title}</h1>
      <h2 className="break-words">{result.collection.name}</h2>
      <p>
        {c.revision}: {result.collection.revision}
      </p>
      <p className="text-secondary">{c.note}</p>
      <p className="text-secondary">{copy.note}</p>
      {result.collection.status === "archived" && <p role="note">{c.archived}</p>}
      <form className="nexus-panel flex flex-wrap items-end gap-3 p-4">
        <label className="grid gap-1">
          {copy.target}
          <input
            name="targetMta"
            maxLength={64}
            placeholder="1.6.0-9.22279.0"
            defaultValue={query.targetMta}
            className="border border-base bg-inset p-2"
            required
          />
        </label>
        <Button type="submit" variant="outline">
          {copy.check}
        </Button>
      </form>
      {result.state === "empty" ? (
        <EmptyState title={c.empty} description={c.note} />
      ) : (
        <p role="status" className="font-semibold">
          {copy.states[result.state]}
        </p>
      )}
      <dl className="nexus-panel grid gap-2 p-4 sm:grid-cols-2">
        <dt>{c.items}</dt>
        <dd>{result.itemCount}</dd>
        <dt>{c.roots}</dt>
        <dd>{result.rootSlugs.length}</dd>
        <dt>{c.unavailable}</dt>
        <dd>{result.unavailableItemCount}</dd>
      </dl>
      {result.unavailableItemCount > 0 && (
        <p role="note" className="text-danger">
          {c.withheld}
        </p>
      )}
      <ResourceRequirementsReportBody
        report={result.report}
        scope="library"
        locale={locale}
        showState={false}
        suppressEmptyIssues={result.state === "empty" || result.unavailableItemCount > 0}
        exportHref={`/api/library/collections/${encodeURIComponent(path.id)}/requirements/export${suffix}`}
      />
    </div>
  );
}
