import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { libraryCollectionsService } from "../../../lib/services/library/library-collections-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax4xl as pageShellClass } from "../../shell/page-shell";
import { panelSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { LibraryCollectionCommandForm } from "../collection-command";
import { libraryCollectionHistoryCopy } from "../library-collection-history-i18n";
import { libraryCollectionError, libraryCollectionsCopy } from "../library-collections-i18n";
import { collectionHref, collectionPageParams } from "../library-collections-query";
import { libraryMembershipHistoryCopy } from "../library-membership-history-i18n";
import { membershipHistoryHref } from "../library-membership-history-query";
import { LibraryMembershipBatchForm } from "../membership-batch";

import { linkAccentSmRounded } from "../../shell/link-shell";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${libraryCollectionsCopy(await getRequestLocale()).resourceCollections} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}
export default async function ResourceCollectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, { id }, query] = await Promise.all([getRequestLocale(), params, searchParams]);
  const c = libraryCollectionsCopy(locale),
    dictionary = getDictionary(locale);
  const safeReturn = /^[A-Za-z0-9_-]{1,160}$/u.test(id)
    ? `/workspace/library/${encodeURIComponent(id)}/collections`
    : "/workspace/library";
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={c.resourceCollections}
        message={c.loadUnavailable}
        retryHref={safeReturn}
      />
    );
  }
  if (!actor) return <PlatformSignIn locale={locale} returnPath={safeReturn} />;
  try {
    if (collectionPageParams(query).size)
      throw new AppError("Unexpected resource collections query", 400, "COLLECTION_INVALID");
    const result = await libraryCollectionsService.resourceMemberships(actor, id).catch((error) => {
      if (error instanceof AppError) throw error;
      return null;
    });
    if (!result) {
      return (
        <div className={pageShellClass}>
          <Link href={collectionHref()} className={linkAccentSmRounded}>
            {c.title}
          </Link>
          <h1 className="font-display">{c.resourceCollections}</h1>
          <ErrorState
            title={c.loadUnavailable}
            description={c.loadUnavailableDescription}
            action={
              <Link
                href={`/workspace/library/${encodeURIComponent(id)}/collections`}
                className={linkAccentSmRounded}
              >
                {dictionary.errors.retry}
              </Link>
            }
          />
        </div>
      );
    }
    const href = `/workspace/library/${encodeURIComponent(id)}/collections`;
    return (
      <div className={pageShellClass}>
        <nav className="flex flex-wrap gap-4 text-sm" aria-label={c.library}>
          <Link href="/workspace/library" className={linkAccentSmRounded}>
            {c.library}
          </Link>
          <Link
            href={`${membershipHistoryHref()}?productId=${encodeURIComponent(id)}`}
            className={linkAccentSmRounded}
          >
            {libraryMembershipHistoryCopy(locale).history}
          </Link>
          <Link href={collectionHref()} className={linkAccentSmRounded}>
            {c.title}
          </Link>
          {result.resource.available && (
            <Link
              href={`/workspace/library/${encodeURIComponent(id)}/versions`}
              className={linkAccentSmRounded}
            >
              {c.versions}
            </Link>
          )}
        </nav>
        <h1 className="font-display text-primary">{c.resourceCollections}</h1>
        <Link
          href={`/workspace/library/collections/history?${new URLSearchParams({ productId: id })}`}
          className={linkAccentSmRounded}
        >
          {libraryCollectionHistoryCopy(locale).title}
        </Link>
        <h2 className="break-words text-xl">
          {result.resource.available ? (result.resource.title ?? c.unavailable) : c.unavailable}
        </h2>
        <p className="break-all text-xs text-muted">{id}</p>
        <p role="note" className="text-sm text-secondary">
          {c.membershipNote}
        </p>
        <p className="text-sm text-muted">{c.limit}</p>
        {!result.resource.available && (
          <ErrorState
            id="library-resource-collections-unavailable"
            title={c.unavailableNote}
            description={c.unavailableNoteHint}
          />
        )}
        {!result.resource.canAdd && (
          <ErrorState
            id="library-resource-collections-no-add-access"
            title={c.noAddAccess}
            description={c.noAddAccessHint}
          />
        )}
        {!result.collections.length ? (
          <EmptyState
            title={c.empty}
            description={c.emptyHint}
            action={
              <Link href={collectionHref()} className={linkAccentSmRounded}>
                {c.title}
              </Link>
            }
          />
        ) : null}
        <LibraryMembershipBatchForm key={id} report={result} locale={locale} />
        <ol className="grid gap-4 sm:grid-cols-2">
          {result.collections.map((collection) => {
            const mutable = collection.status === "active" && collection.revision < 2_147_483_647;
            const action = collection.inCollection ? "remove" : "add";
            const permitted =
              mutable &&
              (collection.inCollection ||
                (result.resource.canAdd && collection.itemCount < result.itemLimit));
            return (
              <li key={collection.id} className={panelSpace3P5}>
                <h3 className="break-words font-semibold">
                  <Link href={collectionHref(collection.id)} className={linkAccentSmRounded}>
                    {collection.name}
                  </Link>
                </h3>
                <p className="text-sm">
                  {c[collection.status]} · {c.items}: {collection.itemCount} / {result.itemLimit} ·{" "}
                  {c.revision}: {collection.revision}
                </p>
                <p className="text-sm">
                  {collection.inCollection ? c.inCollection : c.notInCollection}
                </p>
                {permitted ? (
                  <LibraryCollectionCommandForm
                    key={`${actor.id}:${id}:${collection.id}:${collection.revision}:${action}`}
                    actorId={actor.id}
                    locale={locale}
                    collection={collection}
                    productId={id}
                    action={action}
                    returnHref={href}
                  />
                ) : collection.status === "archived" ? (
                  <p className="text-sm text-muted">{c.archivedNote}</p>
                ) : !mutable ? (
                  <ErrorState
                    id="library-resource-collection-revision-locked"
                    title={c.revisionLocked}
                    description={c.revisionLockedHint}
                  />
                ) : collection.itemCount >= result.itemLimit ? (
                  <ErrorState
                    id="library-resource-collection-full"
                    title={c.fullCollection}
                    description={c.capacityErrorDescription}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
        <a
          href={`/api/library/${encodeURIComponent(id)}/collections`}
          className={linkAccentSmRounded}
        >
          {c.json}
        </a>
      </div>
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.statusCode === 404) notFound();
    const title = libraryCollectionError(locale, error.code);
    return (
      <section className={`${pageShellClass} max-w-xl`}>
        <ErrorState
          title={title}
          description={
            title === c.retry
              ? c.loadUnavailableDescription
              : title === c.signInRequired
                ? dictionary.errors.sessionRetryHint
                : title.startsWith(c.fullCollection) || title.startsWith(c.quota)
                  ? c.capacityErrorDescription
                  : title === c.invalid
                    ? dictionary.errors.formErrorHint
                    : c.actionErrorDescription
          }
          action={
            <Link href={collectionHref()} className={linkAccentSmRounded}>
              {c.title}
            </Link>
          }
        />
      </section>
    );
  }
}
