import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequestLocale } from "../lib/i18n-server";
import { resourceMediaCopy } from "../lib/resource-media-i18n";
import { authService } from "../lib/services/auth-service";
import { resourceMediaService } from "../lib/services/resource-media-service";
import { ResourceGallery } from "./resource-gallery";
import { ResourceMediaEditor } from "./resource-media-editor";
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
  if (!actor)
    return (
      <section className="space-y-4 py-16 text-center">
        <h1>{copy.signInRequired}</h1>
        <Link href="/auth/login">{copy.signIn}</Link>
      </section>
    );
  let gallery: Awaited<ReturnType<typeof resourceMediaService.managed>>;
  try {
    gallery = await resourceMediaService.managed(productId, actor.id, staff);
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    throw error;
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8">
      <Link
        href={
          staff
            ? `/admin/resources/${encodeURIComponent(productId)}`
            : `/workspace/resources/${encodeURIComponent(productId)}`
        }
        className="text-accent underline"
      >
        {copy.back}
      </Link>
      <h1 className="font-display text-primary">
        {copy.title} · {gallery.product.title}
      </h1>
      <p className="text-sm text-secondary">{copy.note}</p>
      <p role="note" className="text-sm text-warning">
        {copy.reviewNote}
      </p>
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
