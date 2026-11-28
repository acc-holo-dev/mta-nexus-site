import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellStack6 } from "../../shell/page-shell";
import { type2xlExtraboldPrimary, typeFlexWrapGap4, typeSmMuted } from "../../shell/type-shell";
import { DirectoryFilters, DirectoryResults } from "../directory-server";
import { discoverHref } from "../discover-query";
import { discoveryCopy } from "../discovery-copy";
import {
  discoveryStreamHref,
  parseDiscoveryStreamQuery,
  STREAM_TYPES,
} from "../discovery-stream-contract";
import { discoveryStreamCopy, discoveryStreamError } from "../discovery-stream-copy";
export async function discoveryStreamMetadata(): Promise<Metadata> {
  const copy = discoveryStreamCopy(await getRequestLocale());
  return {
    title: copy.title,
    description: copy.description,
    alternates: { canonical: "/discover/stream" },
  };
}

export async function DiscoveryStreamPage({
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
    <div className={pageShellStack6}>
      <header className="space-y-2">
        <h1 className={type2xlExtraboldPrimary}>{copy.title}</h1>
        <p className={typeSmMuted}>{copy.description}</p>
        <Link href={discoverHref(state ?? fallback)} className={linkAccentSm}>
          {copy.paged}
        </Link>
      </header>
      <nav aria-label={dictionary.discover.tabsLabel} className={typeFlexWrapGap4}>
        {STREAM_TYPES.map((type) => (
          <Link
            key={type}
            aria-current={state?.type === type ? "page" : undefined}
            href={discoveryStreamHref({ ...(state ?? fallback), type })}
            className={linkAccentSm}
          >
            {dictionary.discover[type]}
          </Link>
        ))}
      </nav>
      {state && <DirectoryFilters state={state} locale={locale} path="/discover/stream" stream />}
      {error ? (
        <ErrorState
          title={error}
          description={discoveryCopy(locale).unavailableHint}
          action={
            <Link href={discoveryStreamHref(state ?? fallback)} className={linkAccentSm}>
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
