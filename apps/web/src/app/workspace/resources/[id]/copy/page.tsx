import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { ResourceCopyForm } from "../../../../../components/resource-copy-form";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceCopyCopy, resourceCopyError } from "../../../../../lib/resource-copy-i18n";
import {
  resourceCopiesPageParams,
  resourceCopiesQuery,
  resourceCopyId,
} from "../../../../../lib/resource-copy-query";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceCopyService } from "../../../../../lib/services/resource-copy-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Copy resource | MTA NEXUS",
  robots: { index: false, follow: false },
};
export default async function ResourceCopyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
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
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  const returnPath = `/workspace/resources/${encodeURIComponent(path.id)}/copy`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  try {
    resourceCopiesQuery(resourceCopiesPageParams(query));
    const id = resourceCopyId(path.id),
      preview = await resourceCopyService.preview(actor, id);
    return (
      <section className={pageShellClass}>
        <Link className={navLinkClass} href={`/workspace/resources/${encodeURIComponent(id)}`}>
          {c.back}
        </Link>
        <h1 className="font-display">{c.title}</h1>
        <ResourceCopyForm
          preview={{
            ...preview,
            source: { ...preview.source, updatedAt: preview.source.updatedAt.toISOString() },
          }}
        />
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
              <Link href="/workspace/resources" className={navLinkClass}>
                {c.back}
              </Link>
            }
          />
        </section>
      );
    return (
      <section className={pageShellClass}>
        <Link href={`/workspace/resources/${encodeURIComponent(path.id)}`} className={navLinkClass}>
          {c.back}
        </Link>
        <ErrorState
          id="workspace-resource-copy-unavailable"
          title={c.loadUnavailable}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
}
