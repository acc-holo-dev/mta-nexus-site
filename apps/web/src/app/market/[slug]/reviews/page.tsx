import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authEntryHref } from "../../../../components/auth-return-path";
import { GuestAuthLinks } from "../../../../components/guest-auth-links";
import {
  ResourceReviewList,
  ResourceReviewPager,
} from "../../../../components/resource-review-list";
import { getDictionary } from "../../../../lib/i18n";
import { getRequestLocale } from "../../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../../lib/resource-review-i18n";
import { resourceReviewPageQuery } from "../../../../lib/resource-review-query";
import { authService } from "../../../../lib/services/auth-service";
import { productService } from "../../../../lib/services/product-service";
import { resourceReviewService } from "../../../../lib/services/resource-review-service";
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
    copy = resourceReviewCopy(locale),
    workspace = getDictionary(locale).workspace,
    reviewsPath =
      result.page > 1
        ? `/market/${encodeURIComponent(product.slug)}/reviews?page=${result.page}`
        : `/market/${encodeURIComponent(product.slug)}/reviews`;
  return (
    <section className="mx-auto max-w-4xl space-y-5 py-8">
      <Link
        href={`/market/${encodeURIComponent(product.slug)}`}
        className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
      >
        {copy.back}
      </Link>
      <h1 className="font-display">
        {copy.title} · {product.title}
      </h1>
      <p className="text-sm text-secondary">{copy.subtitle}</p>
      {actor ? (
        <Link
          href={`/workspace/library/review/${encodeURIComponent(product.id)}`}
          className="text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.write}
        </Link>
      ) : (
        <GuestAuthLinks
          loginHref={authEntryHref("login", reviewsPath)}
          registerHref={authEntryHref("register", reviewsPath)}
          signInLabel={copy.signIn}
          createAccountLabel={workspace.createAccount}
        />
      )}
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
