import { AppError } from "@nexus/domain";
import { ErrorState } from "@nexus/ui";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { orderTermsService } from "../../../lib/services/commerce/order-terms-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellMax5xl as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { OrderTermsReportView } from "../order-terms";
import { orderTermsCopy } from "../order-terms-i18n";
import { orderTermsPageQuery } from "../order-terms-query";

import { linkAccentSmRounded } from "../../shell/link-shell";
export async function purchaseTermsMetadata(): Promise<Metadata> {
  return {
    title: `${orderTermsCopy(await getRequestLocale()).title} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function PurchaseTermsScreen({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [store, locale, { id }, query] = await Promise.all([
      cookies(),
      getRequestLocale(),
      params,
      searchParams,
    ]),
    c = orderTermsCopy(locale),
    dictionary = getDictionary(locale);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={c.loadUnavailable}
        retryHref={"/workspace/purchases/"}
      />
    );
  }

  if (!actor)
    return (
      <PlatformSignIn
        locale={locale}
        returnPath={`/workspace/purchases/${encodeURIComponent(id)}/terms`}
      />
    );
  const returnHref = (() => {
    const page = typeof query.page === "string" ? query.page : undefined;
    const base = `/workspace/purchases/${encodeURIComponent(id)}/terms`;
    return page ? `${base}?page=${encodeURIComponent(page)}` : base;
  })();
  try {
    const values = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) throw new AppError("Invalid query", 400, "ORDER_TERMS_INVALID");
      if (value !== undefined) values.set(key, value);
    }
    const report = await orderTermsService.report(actor, id, "buyer", orderTermsPageQuery(values));
    return <OrderTermsReportView report={report} scope="buyer" locale={locale} />;
  } catch (error) {
    if (error instanceof AppError && [403, 404].includes(error.statusCode)) notFound();
    if (error instanceof AppError && error.statusCode === 400)
      return (
        <section className={pageShellClass}>
          <ErrorState
            title={c.invalid}
            description={c.invalidHint}
            action={
              <Link href="/workspace/purchases" className={linkAccentSmRounded}>
                {c.back}
              </Link>
            }
          />
        </section>
      );
    return (
      <section className={pageShellClass}>
        <Link
          href={`/workspace/purchases/${encodeURIComponent(id)}`}
          className={linkAccentSmRounded}
        >
          {c.back}
        </Link>
        <ErrorState
          title={c.loadUnavailable}
          description={c.loadUnavailableHint}
          action={
            <Link href={returnHref} className={linkAccentSmRounded}>
              {dictionary.errors.retry}
            </Link>
          }
        />
      </section>
    );
  }
}
