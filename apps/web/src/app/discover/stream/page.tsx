import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import Link from "next/link";
import { DirectoryFilters, DirectoryResults } from "../../../components/discovery-directory";
import { discoverHref } from "../../../lib/discover-query";
import {
  discoveryStreamHref,
  parseDiscoveryStreamQuery,
  STREAM_TYPES,
} from "../../../lib/discovery-stream-contract";
import { discoveryStreamCopy, discoveryStreamError } from "../../../lib/discovery-stream-copy";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
export const dynamic = "force-dynamic";
const pageShellClass = "min-w-0 space-y-6 overflow-x-clip";
const actionLinkClass =
  "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
export async function generateMetadata() {
  const copy = discoveryStreamCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: "/discover/stream" },
  };
}
export default async function StreamPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getRequestLocale(),
    copy = discoveryStreamCopy(locale),
    dictionary = getDictionary(locale),
    params = new URLSearchParams();
  for (const [key, value] of Object.entries((await searchParams) ?? {}))
    if (value !== undefined)
      for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  const state = parseDiscoveryStreamQuery(params);
  const fallback = parseDiscoveryStreamQuery(new URLSearchParams()) as NonNullable<typeof state>;
  let error = state ? "" : copy.invalid;
  const results = state
    ? await DirectoryResults({ state, locale, path: "/discover/stream", stream: state }).catch(
        (failure: unknown) => {
          error = discoveryStreamError(
            locale,
            failure instanceof AppError ? failure.code : "INTERNAL_ERROR",
          );
          return null;
        },
      )
    : null;
  return (
    <div className={pageShellClass}>
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold text-primary">{copy.title}</h1>
        <p className="text-sm text-muted">{copy.description}</p>
        <Link href={discoverHref(state ?? fallback)} className={actionLinkClass}>
          {copy.paged}
        </Link>
      </header>
      <nav aria-label={dictionary.discover.tabsLabel} className="flex flex-wrap gap-4">
        {STREAM_TYPES.map((type) => (
          <Link
            key={type}
            aria-current={state?.type === type ? "page" : undefined}
            href={discoveryStreamHref({ ...fallback, type, query: state?.query ?? "" })}
            className={actionLinkClass}
          >
            {dictionary.discover[type]}
          </Link>
        ))}
      </nav>
      {state && <DirectoryFilters state={state} locale={locale} path="/discover/stream" stream />}
      {error ? (
        <ErrorState
          id="discover-stream-unavailable"
          title={error}
          action={
            <Link href={discoveryStreamHref(state ?? fallback)} className={actionLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : (
        results
      )}
    </div>
  );
}
