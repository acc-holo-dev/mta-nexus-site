import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceCopyService } from "../../../lib/services/resources/resource-copy-service";
import { formatHistoryDate } from "../../commerce/commerce-history-format";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax4xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { ResourceCopyMetadataView } from "../copy-view";
import { resourceCopyCopy, resourceCopyError } from "../resource-copy-i18n";
import { linkAccentRounded, linkAccentTightRounded } from "../../shell/link-shell";
import {
  resourceCopiesPageParams,
  resourceCopiesQuery,
  resourceCopyId,
} from "../resource-copy-query";

export async function resourceCopyReceiptMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCopyCopy(await getRequestLocale()).recorded} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ResourceCopyReceiptScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; receiptId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, path, query] = await Promise.all([
      cookies(),
      getRequestLocale(),
      params,
      searchParams,
    ]),
    c = resourceCopyCopy(locale),
    dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={c.loadUnavailable}
        retryHref={"/workspace/resources/"}
      />
    );
  }

  const returnPath = `/workspace/resources/${encodeURIComponent(path.id)}/copies/${encodeURIComponent(path.receiptId)}`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  try {
    resourceCopiesQuery(resourceCopiesPageParams(query));
    const id = resourceCopyId(path.id),
      receiptId = resourceCopyId(path.receiptId);
    let detail: Awaited<ReturnType<typeof resourceCopyService.detail>>;
    try {
      detail = await resourceCopyService.detail(actor, id, receiptId);
    } catch (error) {
      if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
      return (
        <section className={pageShellClass}>
          <Link
            href={`/workspace/resources/${encodeURIComponent(id)}/copies`}
            className={linkAccentRounded}
          >
            {c.history}
          </Link>
          <ErrorState
            title={c.loadUnavailable}
            description={c.loadUnavailableHint}
            action={
              <Link href={returnPath} className={linkAccentRounded}>
                {dictionary.errors.retry}
              </Link>
            }
          />
        </section>
      );
    }
    const { receipt } = detail;
    return (
      <section className={pageShellClass}>
        <Link
          href={`/workspace/resources/${encodeURIComponent(id)}/copies`}
          className={linkAccentTightRounded}
        >
          {c.history}
        </Link>
        <h1 className="font-display">
          {c.recorded}: {receipt.target.title}
        </h1>
        <p>
          {c.source}: {receipt.source.title}
        </p>
        <p>{receipt.target.slug}</p>
        <p>
          {c.created}: {formatHistoryDate(receipt.createdAt, locale)}
        </p>
        <p>{c.atCreation}</p>
        <p>
          {c.current}: {c.statuses[detail.targetStatus as keyof typeof c.statuses] ?? c.unavailable}
        </p>
        <p role="note" className="text-sm text-secondary">
          {c.notice}
        </p>
        <h2>{c.snapshot}</h2>
        <ResourceCopyMetadataView metadata={receipt.metadata} locale={locale} />
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/workspace/resources/${encodeURIComponent(receipt.target.id)}`}
            className={linkAccentTightRounded}
          >
            {c.target}
          </Link>
          <a
            href={`/api/products/${encodeURIComponent(id)}/copies/${encodeURIComponent(receipt.id)}/export`}
            className={linkAccentTightRounded}
          >
            {c.export}
          </a>
        </div>
      </section>
    );
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && [400, 409].includes(error.statusCode))
      return (
        <section className={pageShellClass}>
          <ErrorState
            title={resourceCopyError(locale, error.code)}
            description={c.errorDescription}
            action={
              <Link href="/workspace/resources" className={linkAccentRounded}>
                {c.back}
              </Link>
            }
          />
        </section>
      );
    throw error;
  }
}
