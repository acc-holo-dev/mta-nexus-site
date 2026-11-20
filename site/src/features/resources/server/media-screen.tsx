import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceMediaService } from "../../../lib/services/resources/resource-media-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccent } from "../../shell/link-shell";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeDisplayPrimary, typeSmSecondary } from "../../shell/type-shell";
import { ResourceGallery } from "../components/resource-gallery";
import { ResourceMediaEditor } from "../components/resource-media-editor";
import { resourceMediaCopy } from "../resource-media-i18n";

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
      <Link href={backHref} className={linkAccent}>
        {copy.back}
      </Link>
      <ErrorState
        title={copy.loadUnavailable}
        description={copy.loadUnavailableHint}
        action={
          <Link href={retryHref} className={linkAccent}>
            {dictionary.errors.retry}
          </Link>
        }
      />
    </section>
  );
}

export async function resourceMediaMetadata(): Promise<Metadata> {
  return {
    title: `${resourceMediaCopy(await getRequestLocale()).reviewDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
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
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
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
        className={linkAccent}
      >
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>
        {copy.title} · {gallery.product.title}
      </h1>
      <p className={typeSmSecondary}>{copy.note}</p>
      <ErrorState
        id="resource-media-review-note"
        title={copy.reviewNote}
        description={copy.reviewNoteDescription}
      />
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

export async function WorkspaceResourceMediaPage({ params }: { params: Promise<{ id: string }> }) {
  return ResourceMediaScreen({ productId: (await params).id });
}

export async function StaffResourceMediaPage({ params }: { params: Promise<{ id: string }> }) {
  return ResourceMediaScreen({ productId: (await params).id, staff: true });
}
