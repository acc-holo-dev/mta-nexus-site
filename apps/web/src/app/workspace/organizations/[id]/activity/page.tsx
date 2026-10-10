import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import { PlatformSignIn } from "../../../../../components/content-catalog-controls";
import { OrganizationHistoryView } from "../../../../../components/organization-history";
import { getRequestLocale } from "../../../../../lib/i18n-server";
import {
  organizationHistoryCursor,
  organizationHistorySchema,
} from "../../../../../lib/organization-governance-contract";
import {
  organizationGovernanceCopy,
  organizationGovernanceError,
} from "../../../../../lib/organization-governance-copy";
import { authService } from "../../../../../lib/services/auth-service";
import { organizationGovernanceService } from "../../../../../lib/services/organization-governance-service";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return {
    title: organizationGovernanceCopy(await getRequestLocale()).history,
    robots: { index: false, follow: false },
  };
}
export default async function OrganizationHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, { id }, query] = await Promise.all([
    getRequestLocale(),
    cookies(),
    params,
    searchParams,
  ]);
  const actor = await authService.getSession(store.get("nexus_session")?.value);
  if (!actor) return <PlatformSignIn locale={locale} />;
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) for (const item of value) values.append(key, item);
    else if (value !== undefined) values.set(key, value);
  }
  const filters = organizationHistoryCursor(values);
  let error: string | undefined;
  const data =
    filters && /^[a-zA-Z0-9_-]{1,128}$/u.test(id)
      ? await organizationGovernanceService
          .history(id, actor, filters.before)
          .then((result) => organizationHistorySchema.parse(result))
          .catch((caught) => {
            error = organizationGovernanceError(
              locale,
              caught instanceof AppError ? caught.code : "INTERNAL_ERROR",
            );
            return null;
          })
      : null;
  if (!filters) error = organizationGovernanceCopy(locale).invalid;
  return (
    <OrganizationHistoryView
      id={id}
      data={data}
      before={filters?.before}
      locale={locale}
      error={error}
    />
  );
}
