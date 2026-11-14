import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSignIn } from "../../../../../components/platform-sign-in";
import { ResourceReviewEditor } from "../../../../../features/resources/review-controls";
import { getDictionary } from "../../../../../lib/i18n";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import { resourceReviewCopy } from "../../../../../lib/resource-review-i18n";
import { authService } from "../../../../../lib/services/auth-service";
import { resourceReviewService } from "../../../../../lib/services/resource-review-service";

const pageShellClass = "mx-auto min-w-0 max-w-3xl space-y-5 overflow-x-clip py-8";
const navLinkClass =
  "inline-flex min-h-11 items-center rounded text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).write} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [locale, cookieStore, target] = await Promise.all([getRequestLocale(), cookies(), params]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = resourceReviewCopy(typedLocale),
    dictionary = getDictionary(typedLocale),
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  const returnPath = `/workspace/library/review/${encodeURIComponent(target.id)}`;
  if (!actor) return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  const detail = await resourceReviewService.ownDetail(actor, target.id).catch((error) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    return null;
  });
  if (!detail) {
    return (
      <section className={pageShellClass}>
        <Link href="/workspace/library/reviews" className={navLinkClass}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.pageUnavailable}
          description={copy.pageUnavailableDescription}
          action={
            <Link href={returnPath} className={navLinkClass}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
  return (
    <section className={pageShellClass}>
      <Link href="/workspace/library/reviews" className={navLinkClass}>
        {copy.back}
      </Link>
      <h1 className="min-w-0 break-words font-display">{copy.write}</h1>
      <p className="min-w-0 break-words">{detail.product.title ?? copy.unavailable}</p>
      <ResourceReviewEditor
        key={`${actor.id}:${target.id}`}
        productId={target.id}
        review={detail.review}
        canReview={detail.canReview}
        eligibility={detail.eligibility}
        locale={typedLocale}
      />
    </section>
  );
}
