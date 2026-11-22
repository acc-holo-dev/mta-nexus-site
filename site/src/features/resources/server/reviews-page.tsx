import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { productService } from "../../../lib/services/commerce/product-service";
import { isWalletEngineEnabled } from "../../../lib/services/commerce/wallet-payment-service";
import { resourceReviewService } from "../../../lib/services/resources/resource-review-service";
import { authEntryHref } from "../../shell/auth-return";
import { GuestAuthLinks } from "../../shell/guest-auth";
import { linkAccent } from "../../shell/link-shell";
import { pageShellMax4xlCompact } from "../../shell/page-shell";
import { typeSmSecondary } from "../../shell/type-shell";
import { ResourceReviewList, ResourceReviewPager } from "../components/resource-review-list";
import { resourceReviewCopy } from "../resource-review-i18n";
import { resourceReviewPageQuery } from "../resource-review-query";
export async function publicResourceReviewsMetadata(): Promise<Metadata> {
  return { title: `${resourceReviewCopy(await getRequestLocale()).title} | MTA NEXUS` };
}

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
  const walletEnabled = isWalletEngineEnabled();
  const reviewSubtitle = walletEnabled ? copy.walletSubtitle : copy.subtitle;
  const pageQuery = resourceReviewPageQuery(query);

  let product: Awaited<ReturnType<typeof productService.getProductBySlug>> | null = null;
  try {
    product = await productService.getProductBySlug(target.slug);
  } catch {
    return (
      <section className={pageShellMax4xlCompact}>
        <h1 className="font-display">{copy.title}</h1>
        <ErrorState
          title={copy.pageUnavailable}
          description={copy.pageUnavailableDescription}
          action={
            <Link
              href={`/market/${encodeURIComponent(target.slug)}/reviews`}
              className={linkAccent}
            >
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
  if (product?.status !== "published") notFound();

  let actor: Awaited<ReturnType<typeof authService.getSession>> | null = null;
  let sessionFailed = false;
  try {
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  } catch {
    sessionFailed = true;
  }
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
      <section className={pageShellMax4xlCompact}>
        <Link href={`/market/${encodeURIComponent(product.slug)}`} className={linkAccent}>
          {copy.back}
        </Link>
        <h1 className="font-display">
          {copy.title} · {product.title}
        </h1>
        <p className={typeSmSecondary}>{reviewSubtitle}</p>
        <ErrorState
          title={copy.pageUnavailable}
          description={copy.pageUnavailableDescription}
          action={
            <Link href={reviewsPath} className={linkAccent}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section className={pageShellMax4xlCompact}>
      <Link href={`/market/${encodeURIComponent(product.slug)}`} className={linkAccent}>
        {copy.back}
      </Link>
      <h1 className="font-display">
        {copy.title} · {product.title}
      </h1>
      <p className={typeSmSecondary}>{reviewSubtitle}</p>
      {sessionFailed ? (
        <ErrorState
          id="resource-reviews-session-unavailable"
          title={copy.sessionUnavailable}
          description={copy.sessionUnavailableDescription}
          action={
            <Link href={reviewsPath} className={linkAccent}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      ) : actor ? (
        <Link
          href={`/workspace/library/review/${encodeURIComponent(product.id)}`}
          className={linkAccent}
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
        authenticated={sessionFailed ? null : Boolean(actor)}
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
