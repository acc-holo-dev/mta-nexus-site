import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceReviewService } from "../../../../../lib/services/resource-review-service";
import { resourceReviewCopy } from "../../../../../lib/resource-review-i18n";
import { ResourceReviewEditor } from "../../../../../components/resource-review-controls";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).write} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [locale, cookieStore, target] = await Promise.all([getRequestLocale(), cookies(), params]);
  const copy = resourceReviewCopy(locale),
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  if (!actor)
    return (
      <Link href="/auth/login" className="text-accent underline">
        {copy.signIn}
      </Link>
    );
  const detail = await resourceReviewService.ownDetail(actor, target.id).catch((error) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    throw error;
  });
  return (
    <section className="mx-auto max-w-3xl space-y-5 py-8">
      <Link href="/workspace/library/reviews" className="text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display">{copy.write}</h1>
      <p>{detail.product.title ?? copy.unavailable}</p>
      <ResourceReviewEditor
        productId={target.id}
        review={detail.review}
        canReview={detail.canReview}
        locale={locale}
      />
    </section>
  );
}
