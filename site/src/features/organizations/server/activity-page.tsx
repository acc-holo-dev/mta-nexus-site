import { AppError } from "@nexus/domain";
import { cookies } from "next/headers";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { organizationGovernanceService } from "../../../lib/services/organizations/organization-governance-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellClip } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import { OrganizationHistoryView } from "../history-view";
import {
  organizationChangeHistorySchema,
  parseOrganizationChangeHistoryQuery,
} from "../organization-governance-contract";
import {
  organizationGovernanceCopy,
  organizationGovernanceError,
} from "../organization-governance-copy";
import { organizationReturnPath } from "./organization-return-path";

export async function organizationHistoryMetadata() {
  return {
    title: organizationGovernanceCopy(await getRequestLocale()).history,
    robots: { index: false, follow: false },
  };
}
export async function OrganizationHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, { id }, query] = await Promise.all([getRequestLocale(), params, searchParams]);
  const copy = organizationGovernanceCopy(locale);
  const returnPath = organizationReturnPath(id, "activity", query);
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession((await cookies()).get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={copy.history}
        message={copy.unavailable}
        retryHref={returnPath}
      />
    );
  }
  if (!actor)
    return (
      <div className={pageShellClip}>
        <PlatformSignIn locale={locale} returnPath={returnPath} />
      </div>
    );
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) for (const item of value) values.append(key, item);
    else if (value !== undefined) values.set(key, value);
  }
  const filters = parseOrganizationChangeHistoryQuery(values);
  let error: string | undefined;
  const data =
    filters && /^[a-zA-Z0-9_-]{1,128}$/u.test(id)
      ? await organizationGovernanceService
          .history(id, actor, filters.before, filters)
          .then((result) => organizationChangeHistorySchema.parse(result))
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
    <div className={pageShellClip}>
      <OrganizationHistoryView
        id={id}
        data={data}
        before={filters?.before}
        filters={filters ?? { period: "all", group: "all", query: "" }}
        locale={locale}
        error={error}
      />
    </div>
  );
}
