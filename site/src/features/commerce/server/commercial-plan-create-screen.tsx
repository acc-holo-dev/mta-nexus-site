import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { linkAccentSm } from "../../shell/link-shell";
import { pageShellMax4xl } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { typeDisplayPrimary } from "../../shell/type-shell";
import { getCommercialCopy } from "../commercial-i18n";
import { CommercialPlanForm } from "../commercial-plans";
export async function commercialPlanCreateMetadata(): Promise<Metadata> {
  return {
    title: `${getCommercialCopy(await getRequestLocale()).createDocumentTitle} | MTA NEXUS`,
    robots: { index: false, follow: false },
  };
}

export async function CommercialPlanCreateScreen() {
  const [locale, store] = await Promise.all([getRequestLocale(), cookies()]);
  const copy = getCommercialCopy(locale);
  let user: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    user = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={copy.loadUnavailable}
        retryHref={"/admin/commerce/plans/new"}
      />
    );
  }
  if (!user) return <PlatformSignIn locale={locale} returnPath="/admin/commerce/plans/new" />;
  if (user.role !== "admin") notFound();
  return (
    <div className={pageShellMax4xl}>
      <Link href="/admin/commerce/plans" className={linkAccentSm}>
        {copy.back}
      </Link>
      <h1 className={typeDisplayPrimary}>{copy.newPlan}</h1>
      <CommercialPlanForm key={user.id} actorId={user.id} />
    </div>
  );
}
