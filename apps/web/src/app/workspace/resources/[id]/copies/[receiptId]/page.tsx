import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceCopyMetadataView } from "../../../../../../components/resource-copy-metadata";
import { formatHistoryDate } from "../../../../../../lib/commerce-history-format";
import { getRequestLocale } from "../../../../../../lib/i18n-server";
import { resourceCopyCopy, resourceCopyError } from "../../../../../../lib/resource-copy-i18n";
import {
  resourceCopiesPageParams,
  resourceCopiesQuery,
  resourceCopyId,
} from "../../../../../../lib/resource-copy-query";
import { authService } from "../../../../../../lib/services/auth-service";
import { resourceCopyService } from "../../../../../../lib/services/resource-copy-service";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Recorded draft copy | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function ResourceCopyDetailPage({
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
    c = resourceCopyCopy(locale);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor)
    return (
      <section className="space-y-4 py-8">
        <h1>{c.signInRequired}</h1>
        <Link href="/auth/login">{c.signIn}</Link>
      </section>
    );
  try {
    resourceCopiesQuery(resourceCopiesPageParams(query));
    const id = resourceCopyId(path.id),
      receiptId = resourceCopyId(path.receiptId),
      detail = await resourceCopyService.detail(actor, id, receiptId),
      { receipt } = detail;
    return (
      <section className="mx-auto max-w-4xl space-y-6 py-8">
        <Link
          href={`/workspace/resources/${encodeURIComponent(id)}/copies`}
          className="text-accent underline"
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
            className="text-accent underline"
          >
            {c.target}
          </Link>
          <a
            href={`/api/products/${encodeURIComponent(id)}/copies/${encodeURIComponent(receipt.id)}/export`}
            className="text-accent underline"
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
        <section className="space-y-4 py-8">
          <p role="alert">{resourceCopyError(locale, error.code)}</p>
          <Link href="/workspace/resources" className="text-accent underline">
            {c.back}
          </Link>
        </section>
      );
    throw error;
  }
}
