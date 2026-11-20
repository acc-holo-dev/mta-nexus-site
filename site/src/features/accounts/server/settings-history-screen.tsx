import { AppError } from "@nexus/domain";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getDictionary } from "../../../lib/i18n";
import { getRequestLocale } from "../../../lib/i18n/server";
import { authService } from "../../../lib/services/accounts/auth-service";
import { profileChangeHistoryService } from "../../../lib/services/accounts/profile-change-history-service";
import { PlatformSignIn } from "../../shell/guest-auth";
import { pageShellClip as pageShellClass } from "../../shell/page-shell";
import { PlatformSessionError } from "../../shell/session-error";
import {
  privateChangeHistoryCopy,
  privateChangeHistoryError,
} from "../private-change-history-copy";
import { changeHistoryHref } from "../private-change-history-query";
import { ProfileChangeHistoryView } from "../profile-change-history";
import { parseProfileChangeHistoryQuery } from "../profile-change-history-contract";

export async function settingsHistoryMetadata(): Promise<Metadata> {
  return {
    title: privateChangeHistoryCopy(await getRequestLocale()).profileTitle,
    robots: { index: false, follow: false },
  };
}

export async function SettingsHistoryScreen({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [locale, store, query] = await Promise.all([getRequestLocale(), cookies(), searchParams]);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) for (const item of value) params.append(key, item);
    else if (value !== undefined) params.set(key, value);
  }
  const parsedForReturn = parseProfileChangeHistoryQuery(params),
    returnPath = parsedForReturn
      ? changeHistoryHref("/settings/history", parsedForReturn, { fresh: true })
      : params.size
        ? `/settings/history?${params}`
        : "/settings/history";
  let actor: Awaited<ReturnType<typeof authService.getSession>>;
  try {
    actor = await authService.getSession(store.get("nexus_session")?.value);
  } catch {
    return (
      <PlatformSessionError
        locale={locale}
        title={getDictionary(locale).errors.title}
        message={privateChangeHistoryCopy(locale).invalid}
        retryHref={"/settings/history"}
      />
    );
  }

  if (!actor) {
    return (
      <div className={pageShellClass}>
        <PlatformSignIn locale={locale} returnPath={returnPath} />
      </div>
    );
  }
  const parsed = parsedForReturn,
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
  return (
    <div className={pageShellClass}>
      <ProfileChangeHistoryView data={data} filters={filters} locale={locale} error={error} />
    </div>
  );
}
