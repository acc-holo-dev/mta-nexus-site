import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AppError } from "@nexus/domain";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { authService } from "../../../../lib/services/auth-service";
import { productService } from "../../../../lib/services/product-service";
import { resourceReviewService } from "../../../../lib/services/resource-review-service";
import { resourceReviewCopy } from "../../../../lib/resource-review-i18n";
import { resourceReviewPageQuery } from "../../../../lib/resource-review-query";
import {
  ResourceReviewList,
  ResourceReviewPager,
} from "../../../../components/resource-review-list";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return { title: `${resourceReviewCopy(await getRequestLocale()).title} | MTA NEXUS` };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, cookieStore, target, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const [product, actor] = await Promise.all([
    productService.getProductBySlug(target.slug),
    authService.getSession(cookieStore.get("nexus_session")?.value),
  ]);
  if (product?.status !== "published") notFound();
  const result = await resourceReviewService
      .publicPage(product.id, resourceReviewPageQuery(query).page)
      .catch((error) => {
        if (error instanceof AppError && error.statusCode === 404) notFound();
        throw error;
      }),
    copy = resourceReviewCopy(locale);
  return (
    <section className="mx-auto max-w-4xl space-y-5 py-8">
      <Link href={`/market/${encodeURIComponent(product.slug)}`} className="text-accent underline">
        {copy.back}
      </Link>
      <h1 className="font-display">
        {copy.title} · {product.title}
      </h1>
      <p className="text-sm text-secondary">{copy.subtitle}</p>
      <Link
        href={actor ? `/workspace/library/review/${encodeURIComponent(product.id)}` : "/auth/login"}
        className="text-accent underline"
      >
        {actor ? copy.write : copy.signIn}
      </Link>
      <ResourceReviewList
        reviews={result.reviews}
        productId={product.id}
        authenticated={!!actor}
        locale={locale}
      />
      <ResourceReviewPager
        base={`/market/${encodeURIComponent(product.slug)}/reviews`}
        page={result.page}
        totalPages={result.totalPages}
        locale={locale}
      />
    </section>
  );
}
