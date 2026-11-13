import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { authEntryHref } from "../../../components/auth-return-path";
import { GuestAuthLinks } from "../../../components/guest-auth-links";
import { ResourceReviewList, ResourceReviewPager } from "../../../components/resource-review-list";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../lib/resource-review-i18n";
import { resourceReviewPageQuery } from "../../../lib/resource-review-query";
import { authService } from "../../../lib/services/auth-service";
import { productService } from "../../../lib/services/product-service";
import { resourceReviewService } from "../../../lib/services/resource-review-service";

const pageShellClass = "mx-auto min-w-0 max-w-4xl space-y-5 overflow-x-clip py-8";
const actionLinkClass =
  "inline-flex min-h-11 items-center text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export async function PublicResourceReviewsPage({
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
  const copy = resourceReviewCopy(locale);
  const dictionary = getDictionary(locale);
  const workspace = dictionary.workspace;
  const pageQuery = resourceReviewPageQuery(query);

  let product: Awaited<ReturnType<typeof productService.getProductBySlug>> | null = null;
  try {
    product = await productService.getProductBySlug(target.slug);
  } catch {
    return (
      <section className={pageShellClass}>
        <h1 className="font-display">{copy.title}</h1>
        <ErrorState
          title={copy.pageUnavailable}
          action={
            <Link
              href={`/market/${encodeURIComponent(target.slug)}/reviews`}
              className={actionLinkClass}
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
  if (product?.status !== "published") notFound();

  const actor = await authService
    .getSession(cookieStore.get("nexus_session")?.value)
    .catch(() => null);
  const result = await resourceReviewService
    .publicPage(product.id, pageQuery.page)
    .catch((error) => {
      if (error instanceof AppError && error.statusCode === 404) notFound();
      return null;
    });
  const reviewsPath =
    pageQuery.page > 1
      ? `/market/${encodeURIComponent(product.slug)}/reviews?page=${pageQuery.page}`
      : `/market/${encodeURIComponent(product.slug)}/reviews`;

  if (!result) {
    return (
      <section className={pageShellClass}>
        <Link href={`/market/${encodeURIComponent(product.slug)}`} className={actionLinkClass}>
          {copy.back}
        </Link>
        <h1 className="font-display">
          {copy.title} · {product.title}
        </h1>
        <p className="text-sm text-secondary">{copy.subtitle}</p>
        <ErrorState
          title={copy.pageUnavailable}
          action={
            <Link href={reviewsPath} className={actionLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section className={pageShellClass}>
      <Link href={`/market/${encodeURIComponent(product.slug)}`} className={actionLinkClass}>
        {copy.back}
      </Link>
      <h1 className="font-display">
        {copy.title} · {product.title}
      </h1>
      <p className="text-sm text-secondary">{copy.subtitle}</p>
      {actor ? (
        <Link
          href={`/workspace/library/review/${encodeURIComponent(product.id)}`}
          className={actionLinkClass}
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
