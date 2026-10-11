import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceCopyForm } from "../../../../../components/resource-copy-form";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceCopyCopy, resourceCopyError } from "../../../../../lib/resource-copy-i18n";
import {
  resourceCopiesPageParams,
  resourceCopiesQuery,
  resourceCopyId,
} from "../../../../../lib/resource-copy-query";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceCopyService } from "../../../../../lib/services/resource-copy-service";
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
      preview = await resourceCopyService.preview(actor, id);
    return (
      <section className="mx-auto max-w-4xl space-y-6 py-8">
        <Link
          className="text-accent underline"
          href={`/workspace/resources/${encodeURIComponent(id)}`}
        >
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
