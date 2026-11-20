import { AppError } from "@nexus/domain";
import { EmptyState, ErrorState } from "@nexus/ui";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceModerationService } from "../../../lib/services/resources/resource-release-control-service";
import { formatHistoryDate, parseHistoryPage } from "../../commerce/commerce-history-format";
import {
  getResourceReleaseControlCopy,
  resourceModerationLabel,
  resourceStatusLabel,
} from "../../library/resource-release-control-i18n";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm, linkAccentSmRounded, linkMinH } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { panelMinSpace3P5 } from "../../shell/panel-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { ResourceModerationControls } from "../moderation-controls";
import { resourceMediaCopy } from "../resource-media-i18n";
import { resourceRequirementsCopy } from "../resource-requirements-i18n";

export async function staffResourceDetailMetadata(): Promise<Metadata> {
  return {
    title: `${getResourceReleaseControlCopy(await getRequestLocale()).decisionDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function StaffResourceDetailScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const copy = getResourceReleaseControlCopy(locale);
  const dictionary = getDictionary(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/resources/"}
      />
    );
  }

  if (!user)
    return (
      <PlatformSignIn locale={locale} returnPath={`/admin/resources/${encodeURIComponent(id)}`} />
    );
  if (user.role !== "admin" && user.role !== "moderator") notFound();
  const pageNumber = Math.min(parseHistoryPage(query.page), 1000);
  const returnHref =
    pageNumber > 1
      ? `/admin/resources/${encodeURIComponent(id)}?page=${pageNumber}`
      : `/admin/resources/${encodeURIComponent(id)}`;
  let missing = false;
  const result = await resourceModerationService.detail(user, id, pageNumber).catch((error) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) {
      missing = true;
      return null;
    }
    return null;
  });
  if (missing) notFound();
  if (!result) {
    return (
      <div className={pageShellMax4xl}>
        <Link href="/admin/resources" className={linkAccentSm}>
          {copy.moderation}
        </Link>
        <ErrorState
          title={copy.loadUnavailable}
          description={copy.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </div>
    );
  }
  const product = result.product;
  const linkClass =
    "inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";
  return (
    <div className={pageShellMax4xl}>
      <Link href="/admin/resources" className={linkClass}>
        {copy.moderation}
      </Link>
      <h1 className="break-words font-display text-primary">{product.title}</h1>
      <p className="text-secondary">
        {resourceStatusLabel(locale, product.status)} · {product.currentVersion}
      </p>
      <p role="note" className="text-sm text-secondary">
        {copy.moderationNote}
      </p>
      <div className="flex min-w-0 flex-wrap gap-4">
        <Link href={`/admin/resources/${encodeURIComponent(id)}/media`} className={linkClass}>
          {resourceMediaCopy(locale).title}
        </Link>
        <Link
          href={`/admin/resources/${encodeURIComponent(id)}/requirements`}
          className={linkClass}
        >
          {resourceRequirementsCopy(locale).title}
        </Link>
      </div>
      <ResourceModerationControls
        key={`${id}:${product.updatedAt.toISOString()}`}
        product={{ id, status: product.status, updatedAt: product.updatedAt.toISOString() }}
      />
      <h2 className="text-lg font-semibold text-primary">{copy.history}</h2>
      {result.events.length ? (
        <ol className="min-w-0 space-y-3">
          {result.events.map((event) => (
            <li key={event.id} className={panelMinSpace3P5}>
              <h3 className="font-semibold text-primary">
                {resourceModerationLabel(locale, event.action)}
              </h3>
              <time dateTime={event.createdAt.toISOString()} className="text-xs text-muted">
                {formatHistoryDate(event.createdAt, locale)}
              </time>
              {event.reason ? (
                <p className="whitespace-pre-wrap break-words text-sm text-secondary">
                  {event.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          title={copy.empty}
          description={copy.moderationNote}
          icon={<Package className="h-6 w-6" aria-hidden="true" />}
        />
      )}
      {result.totalPages > 1 ? (
        <nav aria-label={copy.page} className="flex flex-wrap gap-4 text-sm">
          {result.page > 1 ? (
            <Link href={`?page=${result.page - 1}`} className={linkClass}>
              {copy.previous}
            </Link>
          ) : null}
          <span className={linkMinH}>
            {copy.page} {result.page} {copy.of} {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={`?page=${result.page + 1}`} className={linkClass}>
              {copy.next}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
