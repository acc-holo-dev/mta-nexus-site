import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../lib/i18n";
import { getRequestLocale } from "../lib/i18n-server";
import { resourceMediaCopy } from "../lib/resource-media-i18n";
import { authService } from "../lib/services/auth-service";
import { resourceMediaService } from "../lib/services/resource-media-service";
import { PlatformSignIn } from "./platform-sign-in";
import { ResourceGallery } from "./resource-gallery";
import { ResourceMediaEditor } from "./resource-media-editor";

const pageShellClass = "mx-auto min-w-0 max-w-5xl space-y-6 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

function mediaAccessError(error: unknown): "missing" | "failed" {
  if (error instanceof AppError && [403, 404].includes(error.statusCode)) return "missing";
  return "failed";
}

function ResourceMediaLoadError({
  locale,
  staff,
  productId,
}: {
  locale: "en" | "ru";
  staff: boolean;
  productId: string;
}) {
  const copy = resourceMediaCopy(locale),
    dictionary = getDictionary(locale);
  const backHref = staff
    ? `/admin/resources/${encodeURIComponent(productId)}`
    : `/workspace/resources/${encodeURIComponent(productId)}`;
  const retryHref = staff
    ? `/admin/resources/${encodeURIComponent(productId)}/media`
    : `/workspace/resources/${encodeURIComponent(productId)}/media`;
  return (
    <section className={pageShellClass}>
      <Link href={backHref} className={navLinkClass}>
        {copy.back}
      </Link>
      <ErrorState
        id="resource-media-load-unavailable"
        title={copy.loadUnavailable}
        action={
          <Link href={retryHref} className={navLinkClass}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

export async function ResourceMediaScreen({
  productId,
  staff = false,
}: {
  productId: string;
  staff?: boolean;
}) {
  const locale = await getRequestLocale(),
    copy = resourceMediaCopy(locale);
  const actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  const returnPath = staff
    ? `/admin/resources/${encodeURIComponent(productId)}/media`
    : `/workspace/resources/${encodeURIComponent(productId)}/media`;
  if (!actor) return <PlatformSignIn locale={locale} returnPath={returnPath} />;
  let gallery: Awaited<ReturnType<typeof resourceMediaService.managed>> | null = null;
  try {
    gallery = await resourceMediaService.managed(productId, actor.id, staff);
  } catch (error) {
    if (mediaAccessError(error) === "missing") notFound();
    return <ResourceMediaLoadError locale={locale} staff={staff} productId={productId} />;
  }
  return (
    <div className={pageShellClass}>
      <Link
        href={
          staff
            ? `/admin/resources/${encodeURIComponent(productId)}`
            : `/workspace/resources/${encodeURIComponent(productId)}`
        }
        className={navLinkClass}
      >
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">
        {copy.title} · {gallery.product.title}
      </h1>
      <p className="text-sm text-secondary">{copy.note}</p>
      <ErrorState id="resource-media-review-note" title={copy.reviewNote} />
      {staff ? (
        <ResourceGallery items={gallery.items} title={gallery.product.title} locale={locale} />
      ) : (
        <ResourceMediaEditor
          key={`${actor.id}:${productId}:${gallery.product.updatedAt}`}
          initial={gallery}
          locale={locale}
        />
      )}
    </div>
  );
}
