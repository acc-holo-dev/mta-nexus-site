import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import { PlatformSignIn } from "../../../components/content-catalog-controls";
import { ProfileChangeHistoryView } from "../../../components/profile-change-history";
import { getRequestLocale } from "../../../lib/i18n-server";
import {
  privateChangeHistoryCopy,
  privateChangeHistoryError,
} from "../../../lib/private-change-history-copy";
import { parseProfileChangeHistoryQuery } from "../../../lib/profile-change-history-contract";
import { authService } from "../../../lib/services/auth-service";
import { profileChangeHistoryService } from "../../../lib/services/profile-change-history-service";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: privateChangeHistoryCopy(await getRequestLocale()).profileTitle,
    robots: { index: false, follow: false },
  };
}
export default async function ProfileHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} />;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  const parsed = parseProfileChangeHistoryQuery(params),
    filters = parsed ?? { period: "all" as const, group: "all" as const, query: "" };
  let error = parsed ? undefined : privateChangeHistoryCopy(locale).invalid;
  const data = parsed
    ? await profileChangeHistoryService.page(actor.id, filters).catch((caught) => {
        error = privateChangeHistoryError(
          locale,
          caught instanceof AppError ? caught.code : "INTERNAL_ERROR",
        );
        return null;
      })
    : null;
  return <ProfileChangeHistoryView data={data} filters={filters} locale={locale} error={error} />;
}
