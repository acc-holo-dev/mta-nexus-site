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
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax4xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { ResourceCopyForm } from "../copy-controls";
import { resourceCopyCopy, resourceCopyError } from "../resource-copy-i18n";
import { linkAccentRounded } from "../../shell/link-shell";
import {
  resourceCopiesPageParams,
  resourceCopiesQuery,
  resourceCopyId,
} from "../resource-copy-query";

export async function resourceCopyCreateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceCopyCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function ResourceCopyCreateScreen({
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

  const returnPath = `/workspace/resources/${encodeURIComponent(path.id)}/copy`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  try {
    resourceCopiesQuery(resourceCopiesPageParams(query));
    const id = resourceCopyId(path.id),
      preview = await resourceCopyService.preview(actor, id);
    return (
      <section className={pageShellClass}>
        <Link className={linkAccentRounded} href={`/workspace/resources/${encodeURIComponent(id)}`}>
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
              <Link href="/workspace/resources" className={linkAccentRounded}>
                {c.back}
              </Link>
            }
          />
        </section>
      );
    return (
      <section className={pageShellClass}>
        <Link
          href={`/workspace/resources/${encodeURIComponent(path.id)}`}
          className={linkAccentRounded}
        >
          {c.back}
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
}
