import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { resourceReviewService } from "../../../lib/services/resources/resource-review-service";
import { resourceReviewCopy } from "../../resources/resource-review-i18n";
import { ResourceReviewEditor } from "../../resources/review-controls";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSmRounded } from "../../shell/link-shell";
import { pageShellMax3xlCompact as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
export async function libraryReviewEditorMetadata(): Promise<Metadata> {
  return {
    title: `${resourceReviewCopy(await getRequestLocale()).write} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function LibraryReviewEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [locale, cookieStore, target] = await Promise.all([getRequestLocale(), cookies(), params]);
  const typedLocale: "en" | "ru" = locale === "ru" ? "ru" : "en";
  const copy = resourceReviewCopy(typedLocale),
    dictionary = getDictionary(typedLocale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(cookieStore.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={typedLocale}
        title={getDictionary(typedLocale).errors.title}
        message={copy.unavailable}
        retryHref={"/workspace/library/reviews"}
      />
    );
  }

  const returnPath = `/workspace/library/review/${encodeURIComponent(target.id)}`;
  if (!actor) return <PlatformSignIn locale={typedLocale} returnPath={returnPath} />;
  const detail = await resourceReviewService.ownDetail(actor, target.id).catch((error) => {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    return null;
  });
  if (!detail) {
    return (
      <section className={pageShellClass}>
        <Link href="/workspace/library/reviews" className={linkAccentSmRounded}>
          {copy.back}
        </Link>
        <ErrorState
          title={copy.pageUnavailable}
          description={copy.pageUnavailableDescription}
          action={
            <Link href={returnPath} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
  return (
    <section className={pageShellClass}>
      <Link href="/workspace/library/reviews" className={linkAccentSmRounded}>
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
